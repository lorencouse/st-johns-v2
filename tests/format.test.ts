import { describe, expect, test } from "bun:test";
import { textWordCount } from "@/lib/format";

describe("textWordCount", () => {
  test("counts words across any whitespace", () => {
    expect(textWordCount("  the  Lord\nis my\tshepherd ")).toBe(5);
  });

  test("an empty string has no words", () => {
    expect(textWordCount("")).toBe(0);
    expect(textWordCount("   ")).toBe(0);
  });
});
