import { describe, expect, test } from "bun:test";
import { createAutosaver, type Fields, type SaveOptions } from "./autosaver";

function recorder(result = true) {
  const calls: Array<{ fields: Fields; options: SaveOptions }> = [];
  const save = async (fields: Fields, options: SaveOptions) => {
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
    expect(calls[0].options).toEqual({ unloading: true });
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
