import { describe, expect, test } from "bun:test";
import {
  blocksToContentJson,
  blocksToPlainText,
  type DocBlock,
} from "@/server/content/document";
import { redoBlockReason, type GuardDraft } from "@/server/content/redo-guard";

const blocks: DocBlock[] = [
  { type: "heading", text: "Welcome", timestamp: 0 },
  { type: "paragraph", text: "Good morning, everyone.", timestamp: 0 },
  { type: "heading", text: "The Sermon", timestamp: 60 },
  { type: "paragraph", text: "Today we read from Luke.", timestamp: 60 },
];

/** A draft exactly as draft-generate writes it. */
function generated(overrides: Partial<GuardDraft> = {}): GuardDraft {
  return {
    status: "working",
    title: "Sunday Service",
    plainText: blocksToPlainText(blocks),
    contentJson: blocksToContentJson(blocks),
    metadataJson: {
      generatedTitle: "Sunday Service",
      sourceVideoTitle: "Sunday 10am Live",
    },
    ...overrides,
  };
}

const drafting = { status: "drafting" };

describe("redoBlockReason", () => {
  test("allows replacing an untouched generated draft", () => {
    expect(redoBlockReason(drafting, generated())).toBeNull();
  });

  test("allows a project with no active draft", () => {
    expect(redoBlockReason(drafting, null)).toBeNull();
  });

  test("keeps every project past drafting", () => {
    for (const status of [
      "ready_for_review",
      "changes_requested",
      "approved",
      "archived",
    ]) {
      expect(redoBlockReason({ status }, generated())).toBe(
        `project is ${status}`
      );
      expect(redoBlockReason({ status }, null)).toBe(`project is ${status}`);
    }
  });

  test("keeps a draft that is submitted or approved", () => {
    expect(redoBlockReason(drafting, generated({ status: "approved" }))).toBe(
      "active draft is approved"
    );
    expect(redoBlockReason(drafting, generated({ status: "submitted" }))).toBe(
      "active draft is submitted"
    );
  });

  test("keeps a draft the studio marked as edited", () => {
    const draft = generated({
      metadataJson: {
        generatedTitle: "Sunday Service",
        humanEditedAt: "2026-10-12T00:00:00.000Z",
      },
    });
    expect(redoBlockReason(drafting, draft)).toBe(
      "active draft was edited in the studio"
    );
  });

  test("keeps a draft whose title was changed", () => {
    expect(redoBlockReason(drafting, generated({ title: "Easter Morning" }))).toBe(
      "active draft title was edited"
    );
  });

  test("compares against the video title when no title was generated", () => {
    const meta = { generatedTitle: "", sourceVideoTitle: "Sunday 10am Live" };
    expect(
      redoBlockReason(
        drafting,
        generated({ title: "Sunday 10am Live", metadataJson: meta })
      )
    ).toBeNull();
    expect(
      redoBlockReason(drafting, generated({ title: "Renamed", metadataJson: meta }))
    ).toBe("active draft title was edited");
  });

  test("keeps a structured draft saved from the studio before the marker", () => {
    // Tiptap's getText() has no "## " heading prefix.
    const studioText = blocks.map((b) => b.text).join("\n\n");
    expect(redoBlockReason(drafting, generated({ plainText: studioText }))).toBe(
      "active draft body was edited"
    );
  });

  test("keeps a draft whose body text was changed", () => {
    const edited = [...blocks];
    edited[1] = { ...edited[1], text: "Good morning, St Johns." };
    expect(
      redoBlockReason(
        drafting,
        generated({ contentJson: blocksToContentJson(edited) })
      )
    ).toBe("active draft body was edited");
  });

  test("ignores empty paragraphs the generator wrote", () => {
    // Empty AI paragraphs leave runs of blank lines in the generated plain
    // text that the Tiptap document does not reproduce.
    const withEmpty: DocBlock[] = [
      blocks[0],
      { type: "paragraph", text: "", timestamp: 0 },
      { type: "paragraph", text: "", timestamp: 0 },
      ...blocks.slice(1),
    ];
    const draft = generated({
      plainText: blocksToPlainText(withEmpty),
      contentJson: blocksToContentJson(withEmpty),
    });
    expect(redoBlockReason(drafting, draft)).toBeNull();
  });
});
