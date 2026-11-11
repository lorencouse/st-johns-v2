import { describe, expect, test } from "bun:test";
import { createAutosaver, type Fields, type SaveRequest } from "./autosaver";

function recorder(result = true) {
  const calls: Array<{ fields: Fields; options: SaveRequest }> = [];
  const save = async (fields: Fields, options: SaveRequest) => {
    calls.push({ fields, options });
    return result;
  };
  return { calls, save };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createAutosaver", () => {
  test("two fields changed within the delay go out together", async () => {
    const { calls, save } = recorder();
    const saver = createAutosaver(save, 5);
    saver.queue({ title: "A" });
    saver.queue({ intro: "B" });
    await wait(20);
    expect(calls.map((c) => c.fields)).toEqual([{ title: "A", intro: "B" }]);
  });

  test("the latest value of a field wins", async () => {
    const { calls, save } = recorder();
    const saver = createAutosaver(save, 1000);
    saver.queue({ title: "old" });
    saver.queue({ title: "new" });
    await saver.flush();
    expect(calls[0].fields).toEqual({ title: "new" });
  });

  test("flush sends right away and only once", async () => {
    const { calls, save } = recorder();
    const saver = createAutosaver(save, 5);
    saver.queue({ title: "A" });
    await saver.flush();
    await wait(20);
    expect(calls).toHaveLength(1);
  });

  test("flush with nothing waiting sends nothing", async () => {
    const { calls, save } = recorder();
    await createAutosaver(save, 5).flush();
    expect(calls).toHaveLength(0);
  });

  test("a field function is read when the save goes out", async () => {
    const { calls, save } = recorder();
    const saver = createAutosaver(save, 1000);
    let body = "first";
    saver.queue(() => ({ body }));
    body = "second";
    await saver.flush();
    expect(calls[0].fields).toEqual({ body: "second" });
  });

  test("flush passes on that the page is unloading", async () => {
    const { calls, save } = recorder();
    const saver = createAutosaver(save, 1000);
    saver.queue({ title: "A" });
    await saver.flush({ unloading: true });
    expect(calls[0].options).toMatchObject({ unloading: true });
  });

  test("a failed save is kept for the next change", async () => {
    let succeed = false;
    const sent: Fields[] = [];
    const saver = createAutosaver(async (fields) => {
      sent.push(fields);
      return succeed;
    }, 1000);
    saver.queue({ title: "A" });
    await saver.flush();
    expect(saver.isDirty()).toBe(true);

    succeed = true;
    saver.queue({ intro: "B" });
    await saver.flush();
    expect(sent[1]).toEqual({ title: "A", intro: "B" });
    expect(saver.isDirty()).toBe(false);
  });

  test("a save that throws counts as failed", async () => {
    const saver = createAutosaver(async () => {
      throw new Error("offline");
    }, 1000);
    saver.queue({ title: "A" });
    await saver.flush();
    expect(saver.isDirty()).toBe(true);
  });

  test("is dirty until the save finishes", async () => {
    let finish: (saved: boolean) => void = () => {};
    const saver = createAutosaver(
      () => new Promise<boolean>((resolve) => (finish = resolve)),
      1000
    );
    saver.queue({ title: "A" });
    const flushed = saver.flush();
    expect(saver.isDirty()).toBe(true);
    finish(true);
    await flushed;
    expect(saver.isDirty()).toBe(false);
  });
});

/** A server that applies each save's fields when its response is given. */
function slowServer() {
  const state: Fields = {};
  const requests: Array<{ fields: Fields; options: SaveRequest; answer: (ok: boolean) => void }> = [];
  const save = (fields: Fields, options: SaveRequest) =>
    new Promise<boolean>((resolve) => {
      requests.push({
        fields,
        options,
        answer: (ok) => {
          if (ok) Object.assign(state, fields);
          resolve(ok);
        },
      });
    });
  return { state, requests, save };
}

describe("createAutosaver ordering", () => {
  test("the nightly report's scenario leaves the newer body saved", async () => {
    // Body save A is slow and fails, body save B succeeds, then a title edit.
    const server = slowServer();
    const saver = createAutosaver(server.save, 1000);
    saver.queue({ body: "v1" });
    const a = saver.flush();
    saver.queue({ body: "v2" });
    const b = saver.flush();
    let answered = 0;
    while (answered < server.requests.length) {
      // B answers before A whenever both are out.
      const open = server.requests.slice(answered);
      const v2 = open.find((r) => r.fields.body === "v2");
      for (const r of v2 ? [v2, ...open.filter((o) => o !== v2)] : open) {
        r.answer(r.fields.body !== "v1");
      }
      answered = server.requests.length;
      await wait(0);
    }
    await Promise.all([a, b]);

    saver.queue({ title: "new title" });
    const c = saver.flush();
    server.requests.slice(answered).forEach((r) => r.answer(true));
    await c;
    expect(server.state).toEqual({ body: "v2", title: "new title" });
  });

  test("a slow failed save does not send its old body over a newer one", async () => {
    const server = slowServer();
    const saver = createAutosaver(server.save, 1000);

    saver.queue({ body: "v1" });
    const first = saver.flush();
    saver.queue({ body: "v2" });
    const second = saver.flush();
    // The second save waits for the first, so it cannot be overtaken.
    expect(server.requests).toHaveLength(1);
    server.requests[0].answer(false);
    await wait(0);
    expect(server.requests[1].fields).toEqual({ body: "v2" });
    server.requests[1].answer(true);
    expect(await first).toBe(true);
    expect(await second).toBe(true);

    saver.queue({ title: "new title" });
    const third = saver.flush();
    expect(server.requests[2].fields).toEqual({ title: "new title" });
    server.requests[2].answer(true);
    expect(await third).toBe(true);
    expect(server.state).toEqual({ body: "v2", title: "new title" });
  });

  test("a failed save keeps no field a later save already sent", async () => {
    const server = slowServer();
    const saver = createAutosaver(server.save, 1000);

    saver.queue({ body: "v1", title: "A" });
    void saver.flush();
    // Leaving the page sends everything at once, past the save in flight.
    saver.queue({ body: "v2" });
    const leaving = saver.flush({ unloading: true });
    expect(server.requests[1].fields).toEqual({ body: "v2", title: "A" });
    expect(server.requests[1].options).toEqual({ unloading: true, seq: 2 });
    server.requests[1].answer(true);
    server.requests[0].answer(false);
    expect(await leaving).toBe(true);
    expect(saver.isDirty()).toBe(false);

    saver.queue({ intro: "B" });
    const next = saver.flush();
    expect(server.requests[2].fields).toEqual({ intro: "B" });
    server.requests[2].answer(true);
    await next;
    expect(server.state).toEqual({ body: "v2", title: "A", intro: "B" });
  });

  test("leaving the page resends a save still in flight", async () => {
    const server = slowServer();
    const saver = createAutosaver(server.save, 1000);
    saver.queue({ body: "v1" });
    void saver.flush();
    void saver.flush({ unloading: true });
    expect(server.requests[1]).toMatchObject({
      fields: { body: "v1" },
      options: { unloading: true },
    });
  });

  test("flush resolves false while a change is unsaved", async () => {
    const saver = createAutosaver(async () => false, 1000);
    saver.queue({ title: "A" });
    expect(await saver.flush()).toBe(false);
  });
});
