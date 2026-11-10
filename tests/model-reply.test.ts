import { describe, expect, test } from "bun:test";
import { asJsonObject, parseModelJson, usageOf } from "@/server/ai/model-reply";
import { parseWordCheck } from "@/server/ai/word-check";

const object = (content: string) => parseModelJson(content, "object", asJsonObject);

describe("parseModelJson", () => {
  test("reads plain JSON", () => {
    expect(object('{"a":1}')).toEqual({ a: 1 });
  });

  test("reads a fenced reply", () => {
    expect(object('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(object('```\n{"a":1}')).toEqual({ a: 1 });
  });

  test("reads JSON inside prose", () => {
    expect(object('Here you go: {"a":1} Thanks!')).toEqual({ a: 1 });
  });

  test("finds an array when asked for one", () => {
    const read = (parsed: unknown) => (Array.isArray(parsed) ? parsed : null);
    expect(parseModelJson("Result: [1,2]", "array", read)).toEqual([1, 2]);
  });

  test("moves on when read rejects or throws", () => {
    const read = (parsed: unknown) => (parsed as { a: { b: number } }).a.b;
    expect(parseModelJson('{"x":1}', "object", read)).toBeNull();
  });

  test("is null for a reply with no JSON", () => {
    expect(object("sorry, no")).toBeNull();
  });
});

describe("usageOf", () => {
  test("maps token counts", () => {
    expect(
      usageOf({ usage: { total_tokens: 3, prompt_tokens: 1, completion_tokens: 2 } })
    ).toEqual({ tokensUsed: 3, inputTokens: 1, outputTokens: 2 });
  });

  test("is null when usage is missing", () => {
    expect(usageOf({})).toEqual({ tokensUsed: null, inputTokens: null, outputTokens: null });
  });
});

describe("parseWordCheck", () => {
  test("understands a fenced reply", () => {
    const reply =
      '```json\n{"suggestions":[{"paragraph":0,"original":"Jon","suggestion":"John","reason":"name"}]}\n```';
    expect(parseWordCheck(reply, [{ id: "p", text: "Jon spoke" }])).toHaveLength(1);
  });
});
