import { describe, expect, test } from "bun:test";
import { isReasoningModel, samplingParams } from "./openai";

describe("samplingParams", () => {
  test("keeps temperature and max_tokens for gpt-4o-mini", () => {
    expect(samplingParams(0.1, 16384, "gpt-4o-mini")).toEqual({ temperature: 0.1, max_tokens: 16384 });
    expect(samplingParams(0.3, undefined, "gpt-4o-mini")).toEqual({ temperature: 0.3 });
  });

  test("uses the settings reasoning models accept", () => {
    expect(samplingParams(0.1, 16384, "gpt-5-nano")).toEqual({
      reasoning_effort: "minimal",
      max_completion_tokens: 16384,
    });
    expect(samplingParams(0, undefined, "o4-mini")).toEqual({ reasoning_effort: "low" });
  });

  test("recognises reasoning models by name", () => {
    expect(isReasoningModel("gpt-5-nano")).toBe(true);
    expect(isReasoningModel("o3")).toBe(true);
    expect(isReasoningModel("gpt-4o-mini")).toBe(false);
    expect(isReasoningModel("gpt-4.1")).toBe(false);
  });
});
