import { describe, expect, test } from "bun:test";
import { pickSourceRevision } from "@/server/transcripts/revisions";

const kinds = (...revisionKinds: string[]) =>
  revisionKinds.map((revisionKind) => ({ revisionKind }));

describe("pickSourceRevision", () => {
  test("prefers a person's edits over anything newer", () => {
    const revisions = kinds("cleaned", "human_edited", "normalized");
    expect(pickSourceRevision(revisions)).toBe(revisions[1]);
  });

  test("then cleaned, then normalized", () => {
    const cleaned = kinds("normalized", "cleaned");
    expect(pickSourceRevision(cleaned)).toBe(cleaned[1]);
    const normalized = kinds("raw_caption_import", "normalized");
    expect(pickSourceRevision(normalized)).toBe(normalized[1]);
  });

  test("falls back to the newest revision", () => {
    const revisions = kinds("raw_caption_import", "raw_caption_import");
    expect(pickSourceRevision(revisions)).toBe(revisions[0]);
  });

  test("is undefined when there are none", () => {
    expect(pickSourceRevision([])).toBeUndefined();
  });
});
