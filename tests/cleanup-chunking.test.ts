import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { MarkedSegment } from "@/server/ai/cleanup";

// aiCleanup calls OpenAI; replace the client before the module under test
// loads so no request ever leaves the process.
let modelReply: () => string = () => "{}";
const create = mock(async () => ({
  model: "test-model",
  usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 },
  choices: [{ message: { content: modelReply() } }],
}));
mock.module("@/server/ai/openai", () => ({
  getOpenAIClient: () => ({ chat: { completions: { create } } }),
  MODEL: "test-model",
}));

const { aiCleanup, buildChunks, splitOversizedSegment } = await import(
  "@/server/ai/cleanup"
);

// Mirrors the bounds in src/server/ai/cleanup.ts.
const MAX_SEGMENT_CHARS = 3000;
const CHUNK_CHARS = 6000;

const words = (text: string) => text.trim().split(/\s+/);

function segment(text: string, start = 0, end = 600): MarkedSegment {
  return { text, start, end, speakerBreak: true };
}

/** Unpunctuated caption text, as auto captions often are. */
function unpunctuated(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(" ");
}

/** Text made of short sentences. */
function sentences(count: number): string {
  return Array.from(
    { length: count },
    (_, i) => `This is sentence number ${i} of the sermon.`
  ).join(" ");
}

describe("splitOversizedSegment", () => {
  test("leaves a segment within the bound untouched", () => {
    const seg = segment(sentences(10));
    expect(splitOversizedSegment(seg)).toEqual([seg]);
  });

  test("splits unpunctuated text on word boundaries without losing a word", () => {
    const seg = segment(unpunctuated(2000));
    const pieces = splitOversizedSegment(seg);

    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.flatMap((p) => words(p.text))).toEqual(words(seg.text));
    for (const piece of pieces) {
      expect(piece.text.length).toBeLessThanOrEqual(MAX_SEGMENT_CHARS);
    }
  });

  test("prefers to break after a sentence end, and keeps every word", () => {
    const seg = segment(sentences(200));
    const pieces = splitOversizedSegment(seg);

    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.flatMap((p) => words(p.text))).toEqual(words(seg.text));
    for (const piece of pieces) {
      expect(piece.text.length).toBeLessThanOrEqual(MAX_SEGMENT_CHARS);
      expect(piece.text).toMatch(/\.$/);
    }
  });

  test("divides the time span across the pieces in order", () => {
    const seg = segment(unpunctuated(2000), 100, 700);
    const pieces = splitOversizedSegment(seg);

    expect(pieces[0].start).toBe(100);
    expect(pieces[pieces.length - 1].end).toBeCloseTo(700);
    for (let i = 1; i < pieces.length; i++) {
      expect(pieces[i].start).toBeCloseTo(pieces[i - 1].end);
      expect(pieces[i].start).toBeGreaterThan(pieces[i - 1].start);
    }
  });

  test("only the first piece keeps the speaker break", () => {
    const pieces = splitOversizedSegment(segment(unpunctuated(2000)));
    expect(pieces.map((p) => p.speakerBreak)).toEqual([
      true,
      ...Array(pieces.length - 1).fill(false),
    ]);
  });
});

describe("buildChunks", () => {
  test("keeps every segment, in order, within the character bound", () => {
    const segments = Array.from({ length: 300 }, (_, i) =>
      segment(sentences(1 + (i % 20)), i * 10, i * 10 + 10)
    );
    const chunks = buildChunks(segments);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(segments);
    for (const chunk of chunks) {
      const size = chunk.reduce((sum, seg) => sum + seg.text.length, 0);
      expect(size).toBeLessThanOrEqual(CHUNK_CHARS);
    }
  });

  test("returns no chunks for no segments", () => {
    expect(buildChunks([])).toEqual([]);
  });

  test("bounds a long unpunctuated transcript once segments are split", () => {
    const segments = [segment(unpunctuated(5000))].flatMap(splitOversizedSegment);
    const chunks = buildChunks(segments);

    expect(chunks.flat().flatMap((s) => words(s.text))).toEqual(
      words(unpunctuated(5000))
    );
    for (const chunk of chunks) {
      const size = chunk.reduce((sum, seg) => sum + seg.text.length, 0);
      expect(size).toBeLessThanOrEqual(CHUNK_CHARS);
    }
  });
});

describe("aiCleanup retention guard", () => {
  const source = [{ text: sentences(30), start: 0, end: 120 }];

  // The failed attempts are logged on purpose; keep them out of test output.
  let quiet: ReturnType<typeof spyOn>[] = [];

  beforeEach(() => {
    quiet = (["log", "warn", "error"] as const).map((level) =>
      spyOn(console, level).mockImplementation(() => {})
    );
  });

  afterEach(() => {
    create.mockClear();
    for (const spy of quiet) spy.mockRestore();
  });

  test("rejects a reply that condenses the chunk and keeps the local text", async () => {
    // Skip the retry backoff so the test does not wait on real timers.
    const timers = spyOn(globalThis, "setTimeout").mockImplementation(((
      fn: () => void
    ) => {
      fn();
      return 0;
    }) as unknown as typeof setTimeout);
    modelReply = () =>
      JSON.stringify({
        paragraphs: [{ timestamp: 0, text: "A short summary of the sermon." }],
      });

    try {
      const result = await aiCleanup(source);

      expect(create).toHaveBeenCalledTimes(3);
      expect(result.degradedChunks).toBe(1);
      const kept = result.paragraphs.map((p) => p.text).join(" ");
      expect(words(kept).length).toBe(words(source[0].text).length);
    } finally {
      timers.mockRestore();
    }
  });

  test("accepts a reply that keeps the text", async () => {
    modelReply = () =>
      JSON.stringify({ paragraphs: [{ timestamp: 0, text: source[0].text }] });

    const result = await aiCleanup(source);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.degradedChunks).toBe(0);
    expect(result.aiModel).toBe("test-model");
  });
});
