/**
 * Models sometimes wrap their JSON in a markdown fence or a sentence of prose.
 * Yields the text most likely to be the JSON, best guess first.
 */
function* jsonCandidates(content: string, shape: "object" | "array") {
  yield content;

  const stripped = content.trim();
  if (stripped.startsWith("```")) {
    const lines = stripped.split("\n");
    yield lines
      .slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined)
      .join("\n");
  }

  const outermost = shape === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = content.match(outermost);
  if (match) yield match[0];
}

/**
 * Reads a model's JSON reply. `read` turns parsed JSON into the wanted value,
 * or null if it is not what was asked for; the first readable candidate wins.
 */
export function parseModelJson<T>(
  content: string,
  shape: "object" | "array",
  read: (parsed: unknown) => T | null
): T | null {
  for (const candidate of jsonCandidates(content, shape)) {
    try {
      const value = read(JSON.parse(candidate));
      if (value !== null) return value;
    } catch {
      // Not JSON, or not the expected shape: try the next candidate.
    }
  }
  return null;
}

/** Accepts any JSON object, for replies whose fields are checked afterwards. */
export function asJsonObject(parsed: unknown): Record<string, unknown> | null {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/** The token counts a completion reports, or nulls if it reports none. */
export function usageOf(response: {
  usage?: {
    total_tokens?: number | null;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
}) {
  return {
    tokensUsed: response.usage?.total_tokens ?? null,
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
  };
}
