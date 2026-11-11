import { describe, expect, test } from "bun:test";
import { createAutosaver, type Fields, type SaveRequest } from "./autosaver";
import { isStaleSave, parseSaveStamp, type SaveStamp } from "./save-order";

/**
 * A draft on the server that applies the same order check as the PATCH route,
 * with saves the test lets land in any order.
 */
function server(session: string) {
  let draft: Fields = {};
  let stored: SaveStamp | null = null;
  const requests: Array<{ fields: Fields; request: SaveRequest; land: () => void }> = [];
  const save = (fields: Fields, request: SaveRequest) =>
    new Promise<boolean>((resolve) => {
      requests.push({
        fields,
        request,
        land: () => {
          const stamp = parseSaveStamp({ session, seq: request.seq });
          if (!isStaleSave(stored, stamp)) {
            draft = { ...draft, ...fields };
            stored = stamp;
          }
          resolve(true);
        },
      });
    });
  return { save, requests, draft: () => draft };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("save order", () => {
  test("a save landing after the unload save does not put older text back", async () => {
    const s = server("page-1");
    const saver = createAutosaver(s.save, 10_000);
    saver.queue({ body: "v1" });
    void saver.flush(); // request 1 is on its way
    saver.queue({ body: "v2" });
    void saver.flush({ unloading: true }); // the page closes

    expect(s.requests.map((r) => r.fields.body)).toEqual(["v1", "v2"]);
    expect(s.requests[1].request.seq).toBeGreaterThan(s.requests[0].request.seq);

    s.requests[1].land();
    await settle();
    s.requests[0].land();
    await settle();

    expect(s.draft().body).toBe("v2");
  });

  test("saves landing in order all apply", async () => {
    const s = server("page-1");
    const saver = createAutosaver(s.save, 10_000);
    saver.queue({ body: "v1" });
    void saver.flush();
    saver.queue({ body: "v2" });
    void saver.flush({ unloading: true });

    s.requests[0].land();
    await settle();
    s.requests[1].land();
    await settle();

    expect(s.draft().body).toBe("v2");
  });

  test("only saves from the same page are ordered", () => {
    const stored = { session: "a", seq: 5 };
    expect(isStaleSave(stored, { session: "a", seq: 4 })).toBe(true);
    expect(isStaleSave(stored, { session: "a", seq: 5 })).toBe(true);
    expect(isStaleSave(stored, { session: "a", seq: 6 })).toBe(false);
    expect(isStaleSave(stored, { session: "b", seq: 1 })).toBe(false);
  });

  test("a save with no stamp, or none stored, always applies", () => {
    expect(isStaleSave(null, { session: "a", seq: 1 })).toBe(false);
    expect(isStaleSave({ session: "a", seq: 1 }, null)).toBe(false);
  });

  test("a malformed stamp reads as none", () => {
    expect(parseSaveStamp(undefined)).toBeNull();
    expect(parseSaveStamp({ session: "", seq: 1 })).toBeNull();
    expect(parseSaveStamp({ session: "a", seq: "1" })).toBeNull();
    expect(parseSaveStamp({ session: "a", seq: 1.5 })).toBeNull();
    expect(parseSaveStamp({ session: "a", seq: -1 })).toBeNull();
    expect(parseSaveStamp({ session: "a".repeat(101), seq: 1 })).toBeNull();
    expect(parseSaveStamp({ session: "a", seq: 2 })).toEqual({ session: "a", seq: 2 });
  });
});
