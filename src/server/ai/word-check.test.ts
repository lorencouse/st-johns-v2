import { describe, expect, test } from "bun:test";
import { chunkParagraphs, parseWordCheck } from "./word-check";

const paragraphs = [
  { id: "a", text: "Our reading today is from Isiah forty." },
  { id: "b", text: "Father Mikel will lead us in prayer." },
];

describe("parseWordCheck", () => {
  test("maps each suggestion to its paragraph", () => {
    const out = parseWordCheck(
      JSON.stringify({
        suggestions: [
          { paragraph: 0, original: "Isiah forty", suggestion: "Isaiah 40", reason: "The bulletin lists Isaiah 40." },
          { paragraph: 1, original: "Father Mikel", suggestion: "Fr. Michael", reason: "" },
        ],
      }),
      paragraphs
    );
    expect(out).toEqual([
      { paragraphId: "a", original: "Isiah forty", suggestion: "Isaiah 40", reason: "The bulletin lists Isaiah 40." },
      { paragraphId: "b", original: "Father Mikel", suggestion: "Fr. Michael", reason: "The service documents spell it this way." },
    ]);
  });

  test("drops suggestions for text that is not in the paragraph", () => {
    const out = parseWordCheck(
      JSON.stringify({
        suggestions: [
          { paragraph: 1, original: "Isiah forty", suggestion: "Isaiah 40" },
          { paragraph: 0, original: "Jeremiah", suggestion: "Jeremiah 29" },
        ],
      }),
      paragraphs
    );
    expect(out).toEqual([]);
  });

  test("drops bad indexes, no-op changes, duplicates and long phrases", () => {
    const out = parseWordCheck(
      JSON.stringify({
        suggestions: [
          { paragraph: 5, original: "Isiah", suggestion: "Isaiah" },
          { paragraph: "x", original: "Isiah", suggestion: "Isaiah" },
          { paragraph: 0, original: "Isiah", suggestion: "Isiah" },
          { paragraph: 0, original: "Isiah", suggestion: "Isaiah" },
          { paragraph: 0, original: "Isiah", suggestion: "Isaiah" },
          { paragraph: 0, original: "Our reading today is from Isiah forty.", suggestion: "x".repeat(90) },
        ],
      }),
      paragraphs
    );
    expect(out.map((s) => s.suggestion)).toEqual(["Isaiah"]);
  });

  test("returns nothing for a reply that is not JSON", () => {
    expect(parseWordCheck("Sorry, I can't help.", paragraphs)).toEqual([]);
    expect(parseWordCheck('{"suggestions": "none"}', paragraphs)).toEqual([]);
  });

  test("reads JSON wrapped in extra text", () => {
    const out = parseWordCheck(
      'Here you go: {"suggestions":[{"paragraph":0,"original":"Isiah","suggestion":"Isaiah"}]}',
      paragraphs
    );
    expect(out).toHaveLength(1);
  });
});

describe("chunkParagraphs", () => {
  test("splits on size and keeps every paragraph in order", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: String(i), text: "x".repeat(40) }));
    const chunks = chunkParagraphs(many, 100);
    expect(chunks.map((c) => c.length)).toEqual([2, 2, 2, 2, 2]);
    expect(chunks.flat().map((p) => p.id)).toEqual(many.map((p) => p.id));
  });

  test("never makes an empty chunk for one oversized paragraph", () => {
    const chunks = chunkParagraphs([{ id: "big", text: "x".repeat(500) }], 100);
    expect(chunks).toEqual([[{ id: "big", text: "x".repeat(500) }]]);
  });
});
