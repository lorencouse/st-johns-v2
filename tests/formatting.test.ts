import { describe, expect, test } from "bun:test";
import {
  blocksFromContentJson,
  blocksToContentJson,
  blocksToPlainText,
  buildBlocks,
  TRANSCRIPT_DISCLAIMER,
  type DocBlock,
} from "@/server/content/document";
import {
  cleanHeading,
  cleanTitle,
  normalizeSections,
} from "@/server/ai/structure";
import { renderHtml, renderMarkdown } from "@/server/export/render";
import { anchorParagraphTimestamps, type Paragraph } from "@/server/ai/cleanup";
import type { CaptionSegment } from "@/server/youtube/api";

function paragraphs(count: number): Paragraph[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: i * 30,
    text: `Paragraph ${i} body text.`,
  }));
}

describe("normalizeSections", () => {
  const source = paragraphs(30);

  test("keeps a well-formed outline and attaches source timestamps", () => {
    const sections = normalizeSections(
      [
        { startIndex: 0, heading: "Welcome" },
        { startIndex: 8, heading: "The Reading" },
        { startIndex: 20, heading: "Benediction" },
      ],
      source
    );
    expect(sections).toEqual([
      { startIndex: 0, heading: "Welcome", timestamp: 0 },
      { startIndex: 8, heading: "The Reading", timestamp: 240 },
      { startIndex: 20, heading: "Benediction", timestamp: 600 },
    ]);
  });

  test("sorts out-of-order sections and drops out-of-range indices", () => {
    const sections = normalizeSections(
      [
        { startIndex: 12, heading: "Second" },
        { startIndex: 0, heading: "First" },
        { startIndex: 99, heading: "Past The End" },
        { startIndex: -3, heading: "Before The Start" },
      ],
      source
    );
    expect(sections.map((s) => s.heading)).toEqual(["First", "Second"]);
  });

  test("drops headings bunched closer than the minimum section length", () => {
    const sections = normalizeSections(
      [
        { startIndex: 0, heading: "One" },
        { startIndex: 1, heading: "Two" },
        { startIndex: 2, heading: "Three" },
        { startIndex: 10, heading: "Four" },
      ],
      source
    );
    expect(sections.map((s) => s.heading)).toEqual(["One", "Four"]);
  });

  test("pulls the first heading to paragraph 0 so no text is orphaned", () => {
    const sections = normalizeSections(
      [{ startIndex: 5, heading: "Opening" }],
      source
    );
    expect(sections[0]).toEqual({
      startIndex: 0,
      heading: "Opening",
      timestamp: 0,
    });
  });

  test("returns nothing for a malformed response", () => {
    expect(normalizeSections(null, source)).toEqual([]);
    expect(normalizeSections([{ heading: "No Index" }], source)).toEqual([]);
    expect(normalizeSections([{ startIndex: 0 }], source)).toEqual([]);
  });
});

describe("cleanHeading", () => {
  test("strips the markup and numbering the prompt asked the model to omit", () => {
    expect(cleanHeading("## 3. The Good Shepherd.")).toBe("The Good Shepherd");
    expect(cleanHeading('"[12:34] Closing Prayer"')).toBe("Closing Prayer");
    expect(cleanHeading("  Grace   Abounds  ")).toBe("Grace Abounds");
  });

  test("rejects an empty heading", () => {
    expect(cleanHeading("   ")).toBeNull();
    expect(cleanHeading("###")).toBeNull();
  });
});

describe("cleanTitle", () => {
  test("normalizes a usable title", () => {
    expect(cleanTitle('# "Walking In The Light."')).toBe("Walking In The Light");
  });

  test("rejects a missing or overlong title", () => {
    expect(cleanTitle(undefined)).toBeNull();
    expect(cleanTitle("x".repeat(200))).toBeNull();
  });
});

describe("buildBlocks", () => {
  test("interleaves headings ahead of the paragraph they start at", () => {
    const blocks = buildBlocks(paragraphs(6), [
      { startIndex: 0, heading: "Welcome", timestamp: 0 },
      { startIndex: 3, heading: "The Message", timestamp: 90 },
    ]);
    expect(blocks.map((b) => `${b.type}:${b.text}`)).toEqual([
      "heading:Welcome",
      "paragraph:Paragraph 0 body text.",
      "paragraph:Paragraph 1 body text.",
      "paragraph:Paragraph 2 body text.",
      "heading:The Message",
      "paragraph:Paragraph 3 body text.",
      "paragraph:Paragraph 4 body text.",
      "paragraph:Paragraph 5 body text.",
    ]);
  });

  test("passes paragraphs through untouched when there is no outline", () => {
    const blocks = buildBlocks(paragraphs(3), []);
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.type === "paragraph")).toBe(true);
  });
});

describe("Tiptap document round-trip", () => {
  const blocks = buildBlocks(paragraphs(4), [
    { startIndex: 0, heading: "Welcome", timestamp: 0 },
  ]);

  test("survives a trip through content JSON with timestamps intact", () => {
    expect(blocksFromContentJson(blocksToContentJson(blocks))).toEqual(blocks);
  });

  test("stores each block as its own node so paragraphs render separately", () => {
    const doc = blocksToContentJson(blocks);
    expect(doc.content).toHaveLength(5);
    expect(doc.content[0].attrs).toMatchObject({ level: 2, time: "0:00" });
    expect(doc.content[2].attrs).toMatchObject({ timestamp: 30, time: "0:30" });
  });

  test("accepts editor-authored blocks that carry no timestamp", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Added By Hand" }] },
        { type: "paragraph", content: [{ type: "text", text: "New text." }] },
        { type: "paragraph", content: [] },
      ],
    };
    expect(blocksFromContentJson(doc)).toEqual([
      { type: "heading", text: "Added By Hand", timestamp: null },
      { type: "paragraph", text: "New text.", timestamp: null },
    ]);
  });

  test("ignores a document that is missing or malformed", () => {
    expect(blocksFromContentJson(null)).toEqual([]);
    expect(blocksFromContentJson({ type: "doc" })).toEqual([]);
  });

  test("marks headings in plain text", () => {
    expect(blocksToPlainText(blocks).startsWith("## Welcome\n\n")).toBe(true);
  });
});

describe("export rendering", () => {
  const blocks: DocBlock[] = [
    { type: "heading", text: "Welcome", timestamp: 0 },
    { type: "paragraph", text: "First & best.", timestamp: 0 },
    { type: "heading", text: "The Message", timestamp: 754 },
    { type: "paragraph", text: "Second.", timestamp: 754 },
    { type: "paragraph", text: "Added by hand.", timestamp: null },
  ];

  test("HTML carries the disclaimer, headings and deep links", () => {
    const html = renderHtml("abc123", blocks, { intro: "Hi", summary: null });
    expect(html).toContain(TRANSCRIPT_DISCLAIMER);
    expect(html).toContain("<h2>The Message <small>");
    expect(html).toContain("https://www.youtube.com/watch?v=abc123&t=754s");
    expect(html).toContain(">12:34<");
    expect(html).toContain("<p>First &amp; best.</p>");
    // A block an editor added has no timestamp, so it gets no link.
    expect(html).toContain("<p>Added by hand.</p>");
  });

  test("Markdown carries the disclaimer, headings and deep links", () => {
    const md = renderMarkdown("abc123", blocks, { title: "A Post" });
    expect(md).toContain("# A Post");
    expect(md).toContain(`_${TRANSCRIPT_DISCLAIMER}_`);
    expect(md).toContain(
      "### The Message [12:34](https://www.youtube.com/watch?v=abc123&t=754s)"
    );
    expect(md).toContain("Added by hand.");
  });
});

describe("anchorParagraphTimestamps", () => {
  // Ten segments, ten seconds and two words apiece.
  const segments: CaptionSegment[] = Array.from({ length: 10 }, (_, i) => ({
    start: i * 10,
    end: i * 10 + 10,
    text: `word${i}a word${i}b`,
  }));

  test("discards the model's timestamps and rebuilds them from the source", () => {
    // What a later chunk actually returns: numbering restarted near zero.
    const modelOutput: Paragraph[] = [
      { timestamp: 0, text: "aa bb cc dd" },
      { timestamp: 5, text: "ee ff gg hh" },
      { timestamp: 9, text: "ii jj kk ll" },
      { timestamp: 14, text: "mm nn oo pp" },
      { timestamp: 20, text: "qq rr ss tt" },
    ];
    const anchored = anchorParagraphTimestamps(modelOutput, segments);
    expect(anchored.map((p) => p.timestamp)).toEqual([0, 20, 40, 60, 80]);
    expect(anchored.map((p) => p.text)).toEqual(modelOutput.map((p) => p.text));
  });

  test("never runs backwards, which was the bug it exists to fix", () => {
    const scrambled: Paragraph[] = [
      { timestamp: 900, text: "one two three" },
      { timestamp: 12, text: "four five six" },
      { timestamp: 300, text: "seven eight nine" },
      { timestamp: 4, text: "ten eleven twelve" },
    ];
    const anchored = anchorParagraphTimestamps(scrambled, segments);
    for (let i = 1; i < anchored.length; i++) {
      expect(anchored[i].timestamp).toBeGreaterThanOrEqual(
        anchored[i - 1].timestamp
      );
    }
  });

  test("stays inside the span of the segments it was given", () => {
    const anchored = anchorParagraphTimestamps(
      [
        { timestamp: 99999, text: "alpha beta" },
        { timestamp: -5, text: "gamma delta" },
      ],
      segments
    );
    expect(anchored[0].timestamp).toBeGreaterThanOrEqual(0);
    expect(anchored[anchored.length - 1].timestamp).toBeLessThanOrEqual(90);
  });

  test("leaves the input alone when there is nothing to anchor against", () => {
    const input: Paragraph[] = [{ timestamp: 7, text: "unchanged" }];
    expect(anchorParagraphTimestamps(input, [])).toEqual(input);
    expect(anchorParagraphTimestamps([], segments)).toEqual([]);
  });
});
