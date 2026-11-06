import { describe, expect, test } from "bun:test";
import { toBlocks } from "@/components/library/transcript-review-client";

const segments = [
  { seq: 0, startMs: 0, endMs: 1000, text: "First" },
  { seq: 1, startMs: 1000, endMs: 2000, text: "Second" },
];

describe("transcript review paragraph ids", () => {
  test("the server render and the client hydration get the same ids", () => {
    const server = toBlocks(segments).map((b) => b.id);
    const client = toBlocks(segments).map((b) => b.id);
    expect(client).toEqual(server);
    expect(new Set(server).size).toBe(segments.length);
  });
});
