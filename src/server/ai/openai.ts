import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Reasoning models (the gpt-5 family and the o-series) reject `temperature`
 * and `max_tokens`, so every request built for gpt-4o-mini fails outright on
 * them. Production runs OPENAI_MODEL=gpt-5-nano, which made each AI pass fall
 * back to its no-AI path. This returns the settings the model accepts.
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model.trim());
}

export function samplingParams(
  temperature: number,
  maxTokens?: number,
  model: string = MODEL
):
  | { temperature: number; max_tokens?: number }
  | { reasoning_effort: "minimal" | "low"; max_completion_tokens?: number } {
  if (isReasoningModel(model)) {
    return {
      // Editing and extraction need little thought; keep them fast and cheap.
      reasoning_effort: /^gpt-5/i.test(model.trim()) ? "minimal" : "low",
      ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
    };
  }
  return { temperature, ...(maxTokens ? { max_tokens: maxTokens } : {}) };
}
