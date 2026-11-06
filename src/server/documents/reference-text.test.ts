import { describe, expect, test } from "bun:test";
import { buildReferenceText, withReference } from "./reference-text";

describe("buildReferenceText", () => {
  test("returns null when nothing has readable text", () => {
    expect(buildReferenceText([])).toBeNull();
    expect(
      buildReferenceText([{ kind: "sermon", fileName: "a.jpg", extractedText: null }])
    ).toBeNull();
    expect(
      buildReferenceText([{ kind: "sermon", fileName: "a.txt", extractedText: "   " }])
    ).toBeNull();
  });

  test("puts the bulletin first and labels each document", () => {
    const text = buildReferenceText([
      { kind: "sermon", fileName: "sermon.docx", extractedText: "Grace abounds." },
      { kind: "bulletin", fileName: "bulletin.pdf", extractedText: "Hymn 410: Praise, My Soul" },
    ])!;
    expect(text.indexOf("Service bulletin (bulletin.pdf)")).toBeLessThan(
      text.indexOf("Sermon text or notes (sermon.docx)")
    );
    expect(text).toContain("Hymn 410: Praise, My Soul");
    expect(text).toContain("Grace abounds.");
  });

  test("stays within the budget and keeps a short bulletin whole", () => {
    const bulletin = "Reading: Isaiah 40:28-31. Hymn: Be Thou My Vision.";
    const text = buildReferenceText(
      [
        { kind: "sermon", fileName: "s.txt", extractedText: "word ".repeat(5000) },
        { kind: "bulletin", fileName: "b.txt", extractedText: bulletin },
      ],
      2000
    )!;
    expect(text.length).toBeLessThanOrEqual(2000 + " [...]".length);
    expect(text).toContain(bulletin);
    expect(text).toContain("[...]");
  });
});

describe("withReference", () => {
  test("leaves the prompt unchanged without documents", () => {
    expect(withReference("Base prompt.", null)).toBe("Base prompt.");
  });

  test("adds the documents and the rule not to copy from them", () => {
    const prompt = withReference("Base prompt.", "Hymn 410");
    expect(prompt.startsWith("Base prompt.")).toBe(true);
    expect(prompt).toContain("<reference_documents>\nHymn 410\n</reference_documents>");
  });
});
