import { getOpenAIClient, MODEL, samplingParams } from "./openai";
import { withRetries } from "./cleanup";
import { asJsonObject, parseModelJson } from "./model-reply";

/**
 * "Check the words": compares the transcript with the service's sermon and
 * bulletin and lists only the spots where a name, verse or title looks
 * misheard, each with the spelling the documents use.
 */

export interface WordCheckParagraph {
  id: string;
  text: string;
}

export interface WordSuggestion {
  paragraphId: string;
  /** Exact text in the paragraph to replace. */
  original: string;
  suggestion: string;
  reason: string;
}

/** Paragraph text sent per request, besides the reference. */
const CHUNK_CHARS = 12_000;
const MAX_SUGGESTIONS = 60;
const MAX_PHRASE_CHARS = 80;
const MAX_REASON_CHARS = 140;

const WORD_CHECK_PROMPT = `You check church service transcripts made by automatic captions against the service's own documents (the bulletin, sermon text or notes).

You will receive the reference documents and a numbered list of transcript paragraphs.

Find words or short phrases in the transcript that are probably misheard or misspelled versions of something in the documents: people's names, place names, Bible book names and verse numbers, hymn, song and reading titles, and church terms. For example "Isiah" where the bulletin says "Isaiah", or "Father Mikel" where the bulletin says "Fr. Michael".

Rules:
- Only report a spot when the documents clearly show the right spelling or wording. Do not report style, grammar, punctuation or filler words.
- "original" must be copied EXACTLY, character for character, from the paragraph, and be as short as possible (a few words).
- "suggestion" replaces exactly the words in "original" and nothing more, so the sentence still reads naturally once swapped. Keep the speaker's own surrounding words, and spell the suggestion exactly as the documents do: for "I'm Father Mikel" the fix is "Mikel" -> "Michael", not a new phrase.
- Spoken numbers are fine as they are unless they are wrong: only correct a verse or hymn number that differs from the documents.
- "reason" is one short plain sentence for a non-technical church volunteer, naming the document, for example "The bulletin spells it this way."
- Do not report a spot that already matches the documents.
- If nothing needs changing, return an empty list.

Return ONLY a JSON object: {"suggestions": [{"paragraph": <number>, "original": "...", "suggestion": "...", "reason": "..."}]}`;

/** Splits paragraphs into requests of roughly CHUNK_CHARS each. */
export function chunkParagraphs(
  paragraphs: WordCheckParagraph[],
  maxChars = CHUNK_CHARS
): WordCheckParagraph[][] {
  const chunks: WordCheckParagraph[][] = [];
  let current: WordCheckParagraph[] = [];
  let size = 0;
  for (const p of paragraphs) {
    if (current.length > 0 && size + p.text.length > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(p);
    size += p.text.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Keeps only suggestions that point at real text in the paragraph they name
 * and actually change it, so a confused model reply can never offer a fix for
 * words that are not there.
 */
export function parseWordCheck(
  content: string,
  paragraphs: WordCheckParagraph[]
): WordSuggestion[] {
  const list = parseModelJson(content, "object", asJsonObject)?.suggestions;
  if (!Array.isArray(list)) return [];

  const out: WordSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { paragraph, original, suggestion, reason } = item as Record<string, unknown>;
    const index = Number(paragraph);
    if (!Number.isInteger(index) || index < 0 || index >= paragraphs.length) continue;
    if (typeof original !== "string" || typeof suggestion !== "string") continue;
    const from = original.trim();
    const to = suggestion.trim();
    if (!from || !to || from === to) continue;
    if (from.length > MAX_PHRASE_CHARS || to.length > MAX_PHRASE_CHARS) continue;
    const target = paragraphs[index];
    if (!target.text.includes(from)) continue;
    const key = `${target.id}\u0000${from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      paragraphId: target.id,
      original: from,
      suggestion: to,
      reason:
        typeof reason === "string" && reason.trim()
          ? reason.trim().slice(0, MAX_REASON_CHARS)
          : "The service documents spell it this way.",
    });
  }
  return out;
}

/** Runs the comparison across the whole transcript. */
export async function checkWords(
  paragraphs: WordCheckParagraph[],
  reference: string
): Promise<WordSuggestion[]> {
  const openai = getOpenAIClient();
  const chunks = chunkParagraphs(paragraphs.filter((p) => p.text.trim()));

  const results = await Promise.all(
    chunks.map(async (chunk, n) => {
      const numbered = chunk.map((p, i) => `${i}. ${p.text}`).join("\n");
      const response = await withRetries(
        () =>
          openai.chat.completions.create({
            model: MODEL,
            messages: [
              { role: "system", content: WORD_CHECK_PROMPT },
              {
                role: "user",
                content: `<reference_documents>\n${reference}\n</reference_documents>\n\n<transcript>\n${numbered}\n</transcript>`,
              },
            ],
            ...samplingParams(0),
            response_format: { type: "json_object" },
          }),
        2,
        `word check ${n + 1}/${chunks.length}`
      );
      return parseWordCheck(response.choices[0]?.message?.content ?? "", chunk);
    })
  );
  return results.flat().slice(0, MAX_SUGGESTIONS);
}
