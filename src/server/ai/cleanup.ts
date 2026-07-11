import { getOpenAIClient, MODEL } from "./openai";
import type { CaptionSegment } from "@/server/youtube/api";

export interface Paragraph {
  timestamp: number;
  text: string;
}

export interface CleanupResult {
  paragraphs: Paragraph[];
  tokensUsed: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  aiModel: string | null;
  /** Chunks that fell back to local (no-AI) cleanup after exhausting retries */
  degradedChunks: number;
}

export interface SummaryResult {
  intro: string;
  summary: string;
  tokensUsed: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

const PARAGRAPH_GAP_SECONDS = 2.0;
const MAX_SENTENCES_PER_PARAGRAPH = 5;
const MIN_SEGMENT_WORDS = 3;
const MIN_PARAGRAPH_WORDS = 8;

const AUDIO_MARKER_RE =
  /\[(?:music|applause|singing|music and singing|laughter|inaudible)\]/gi;

const FILLER_PATTERNS: [RegExp, string][] = [
  [/\b(?:um|uh|umm|uhh|hmm|hm|mm)\b,?\s*/gi, " "],
  [/\byou know,?\s*/gi, " "],
  [/\bI mean,?\s*/gi, " "],
  [/\bright\b[,.]?\s*(?=\s|$)/gi, " "],
  [/\bokay\b[,.]?\s*/gi, " "],
  [/(?:^|(?<=\.\s))(?:so|well),?\s+/gim, ""],
  [/,\s*like,\s*/gi, ", "],
  [/(?:^|(?<=\.\s))like,?\s+/gim, ""],
];

// --- Helpers ---

function stripMarkers(text: string): string {
  return text
    .replace(AUDIO_MARKER_RE, "")
    .replace(/>>+\s*/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w)).length;
}

function removeFillerWords(text: string): string {
  for (const [pattern, replacement] of FILLER_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, replacement);
    text = text.replace(/ {2,}/g, " ").trim();
  }
  return text;
}

function fixPunctuation(text: string): string {
  if (!text) return text;
  text = text.replace(/ {2,}/g, " ");
  text = text.replace(/([.?!])([A-Za-z])/g, "$1 $2");
  text = text.replace(/([.?!]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
  if (text.length > 0 && text[0] >= "a" && text[0] <= "z") {
    text = text[0].toUpperCase() + text.slice(1);
  }
  text = text.trimEnd();
  if (text.length > 0 && !".?!".includes(text[text.length - 1])) {
    text += ".";
  }
  return text;
}

function splitLongParagraph(
  text: string,
  timestamp: number,
  nextTimestamp?: number
): Paragraph[] {
  const parts = text.split(/(?<=[.?!])\s+/);
  if (parts.length <= MAX_SENTENCES_PER_PARAGRAPH) {
    return [{ timestamp, text }];
  }

  const result: Paragraph[] = [];
  const totalChunks = Math.ceil(parts.length / MAX_SENTENCES_PER_PARAGRAPH);
  const duration = nextTimestamp !== undefined ? nextTimestamp - timestamp : 0;

  for (let i = 0; i < parts.length; i += MAX_SENTENCES_PER_PARAGRAPH) {
    const chunkIndex = Math.floor(i / MAX_SENTENCES_PER_PARAGRAPH);
    const chunk = parts.slice(i, i + MAX_SENTENCES_PER_PARAGRAPH).join(" ");
    if (chunk) {
      const chunkTs =
        totalChunks > 1
          ? Math.round(timestamp + (duration * chunkIndex) / totalChunks)
          : timestamp;
      result.push({ timestamp: chunkTs, text: chunk });
    }
  }
  return result;
}

function interpolateDuplicateTimestamps(paragraphs: Paragraph[]): Paragraph[] {
  if (paragraphs.length <= 1) return paragraphs;
  const result = paragraphs.map((p) => ({ ...p }));

  let i = 0;
  while (i < result.length) {
    let j = i + 1;
    while (j < result.length && result[j].timestamp === result[i].timestamp) {
      j++;
    }
    const runLen = j - i;
    if (runLen > 1) {
      const startTs = result[i].timestamp;
      const endTs = j < result.length ? result[j].timestamp : startTs;
      for (let k = 0; k < runLen; k++) {
        result[i + k].timestamp = Math.round(
          startTs + ((endTs - startTs) * k) / runLen
        );
      }
    }
    i = j;
  }
  return result;
}

// --- Public ---

export function filterNoise(segments: CaptionSegment[]): CaptionSegment[] {
  return segments
    .map((seg) => ({ ...seg, text: stripMarkers(seg.text) }))
    .filter((seg) => seg.text && wordCount(seg.text) >= MIN_SEGMENT_WORDS);
}

export function mergeIntoParagraphs(
  segments: CaptionSegment[],
  gapThreshold = PARAGRAPH_GAP_SECONDS
): Paragraph[] {
  if (segments.length === 0) return [];

  const rawParagraphs: Paragraph[] = [];
  let currentTexts = [segments[0].text];
  let currentTimestamp = segments[0].start;

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap > gapThreshold) {
      rawParagraphs.push({
        timestamp: currentTimestamp,
        text: currentTexts.join(" "),
      });
      currentTexts = [segments[i].text];
      currentTimestamp = segments[i].start;
    } else {
      currentTexts.push(segments[i].text);
    }
  }
  rawParagraphs.push({
    timestamp: currentTimestamp,
    text: currentTexts.join(" "),
  });

  const paragraphs: Paragraph[] = [];
  for (let i = 0; i < rawParagraphs.length; i++) {
    const nextTs =
      i + 1 < rawParagraphs.length
        ? rawParagraphs[i + 1].timestamp
        : undefined;
    paragraphs.push(
      ...splitLongParagraph(
        rawParagraphs[i].text,
        rawParagraphs[i].timestamp,
        nextTs
      )
    );
  }

  return paragraphs;
}

export function noAiCleanup(segments: CaptionSegment[]): Paragraph[] {
  const filtered = filterNoise(segments);
  const merged = mergeIntoParagraphs(filtered);
  const cleaned = merged
    .map((p) => ({
      timestamp: p.timestamp,
      text: fixPunctuation(removeFillerWords(stripMarkers(p.text))),
    }))
    .filter((p) => wordCount(p.text) >= MIN_PARAGRAPH_WORDS);

  const final: Paragraph[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const nextTs =
      i + 1 < cleaned.length ? cleaned[i + 1].timestamp : undefined;
    final.push(
      ...splitLongParagraph(cleaned[i].text, cleaned[i].timestamp, nextTs)
    );
  }
  return final;
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// --- AI Cleanup ---

const CLEANUP_SYSTEM_PROMPT = `You are a transcript editor. Clean up the following transcript and return it as structured paragraphs.

Rules:
1. DELETE every filler word and phrase: um, uh, hmm, like, you know, I mean, so, well, right, okay, yeah, and similar hesitations. Remove them completely.
2. Fix garbled, repeated, or nonsensical text from transcription errors.
3. Combine sentence fragments into complete sentences.
4. Fix grammar, spelling, and punctuation.
5. Do not add new content or change the meaning.
6. Break text into logical paragraphs (3-5 sentences each).
7. Preserve the approximate timestamps.

Return a JSON array of objects with "timestamp" (seconds as number) and "text" (cleaned paragraph text) fields.
Return ONLY the JSON array. No explanation, no markdown fences, just the JSON array.`;

function parseCleanupResponse(
  responseText: string,
  fallback: Paragraph[]
): Paragraph[] {
  const tryParse = (text: string): Paragraph[] | null => {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed.paragraphs || parsed.data || parsed.result;
      if (
        Array.isArray(arr) &&
        arr.length > 0 &&
        "timestamp" in arr[0] &&
        "text" in arr[0]
      ) {
        return arr.map((p: { timestamp: number; text: string }) => ({
          timestamp: Number(p.timestamp),
          text: String(p.text),
        }));
      }
    } catch {
      // continue
    }
    return null;
  };

  let result = tryParse(responseText);
  if (result) return result;

  // Strip markdown fences
  const stripped = responseText.trim();
  if (stripped.startsWith("```")) {
    const lines = stripped.split("\n");
    const inner = lines
      .slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined)
      .join("\n");
    result = tryParse(inner);
    if (result) return result;
  }

  // Regex extract [...]
  const match = responseText.match(/\[[\s\S]*\]/);
  if (match) {
    result = tryParse(match[0]);
    if (result) return result;
  }

  return fallback;
}

// Process a single chunk of segments through AI cleanup
async function aiCleanupChunk(
  filtered: CaptionSegment[],
  fallbackParagraphs: Paragraph[]
): Promise<{ paragraphs: Paragraph[]; tokensUsed: number | null; inputTokens: number | null; outputTokens: number | null; aiModel: string | null }> {
  const transcriptText = filtered
    .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text}`)
    .join("\n");

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: CLEANUP_SYSTEM_PROMPT },
      { role: "user", content: transcriptText },
    ],
    temperature: 0.1,
    max_tokens: 16384,
    response_format: { type: "json_object" },
  });

  const tokensUsed = response.usage?.total_tokens ?? null;
  const inputTokens = response.usage?.prompt_tokens ?? null;
  const outputTokens = response.usage?.completion_tokens ?? null;
  const aiModel = response.model ?? MODEL;
  const content = response.choices[0]?.message?.content;

  if (!content) {
    return { paragraphs: fallbackParagraphs, tokensUsed, inputTokens, outputTokens, aiModel };
  }

  let paragraphs = parseCleanupResponse(content, fallbackParagraphs);

  paragraphs = paragraphs.map((p) => ({
    timestamp: p.timestamp,
    text: fixPunctuation(removeFillerWords(p.text)),
  }));

  const final: Paragraph[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const nextTs =
      i + 1 < paragraphs.length ? paragraphs[i + 1].timestamp : undefined;
    final.push(
      ...splitLongParagraph(paragraphs[i].text, paragraphs[i].timestamp, nextTs)
    );
  }

  return { paragraphs: final, tokensUsed, inputTokens, outputTokens, aiModel };
}

// ~200 segments ≈ ~3K input tokens → leaves plenty of room for 16K output
const CHUNK_SIZE = 200;
const CHUNK_ATTEMPTS = 3;

async function withRetries<T>(
  fn: () => Promise<T>,
  attempts: number,
  label: string
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(
        `[ai-cleanup] ${label} attempt ${i + 1}/${attempts} failed: ${err instanceof Error ? err.message : err}`
      );
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
      }
    }
  }
  throw lastErr;
}

export async function aiCleanup(
  segments: CaptionSegment[]
): Promise<CleanupResult> {
  const filtered = filterNoise(segments);

  // Split into chunks to avoid output token truncation
  const chunks: CaptionSegment[][] = [];
  for (let i = 0; i < filtered.length; i += CHUNK_SIZE) {
    chunks.push(filtered.slice(i, i + CHUNK_SIZE));
  }

  console.log(`[ai-cleanup] Processing ${filtered.length} segments in ${chunks.length} chunk(s)`);

  const allParagraphs: Paragraph[] = [];
  let totalTokensUsed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let aiModel: string | null = null;
  let degradedChunks = 0;

  // A long livestream produces dozens of chunks; one transient OpenAI error
  // must degrade only its own section, never discard the other chunks.
  for (let i = 0; i < chunks.length; i++) {
    const chunkFallback = mergeIntoParagraphs(chunks[i]);
    try {
      const result = await withRetries(
        () => aiCleanupChunk(chunks[i], chunkFallback),
        CHUNK_ATTEMPTS,
        `chunk ${i + 1}/${chunks.length}`
      );
      allParagraphs.push(...result.paragraphs);
      totalTokensUsed += result.tokensUsed ?? 0;
      totalInputTokens += result.inputTokens ?? 0;
      totalOutputTokens += result.outputTokens ?? 0;
      aiModel = result.aiModel;
      console.log(`[ai-cleanup] Chunk ${i + 1}/${chunks.length}: ${result.paragraphs.length} paragraphs`);
    } catch (error) {
      degradedChunks++;
      console.error(
        `[ai-cleanup] Chunk ${i + 1}/${chunks.length} failed after ${CHUNK_ATTEMPTS} attempts; using local cleanup for this section:`,
        error
      );
      allParagraphs.push(
        ...chunkFallback.map((p) => ({
          timestamp: p.timestamp,
          text: fixPunctuation(removeFillerWords(p.text)),
        }))
      );
    }
  }

  if (degradedChunks > 0) {
    console.warn(
      `[ai-cleanup] ${degradedChunks}/${chunks.length} chunk(s) used the no-AI fallback`
    );
  }

  return {
    paragraphs: interpolateDuplicateTimestamps(allParagraphs),
    tokensUsed: totalTokensUsed || null,
    inputTokens: totalInputTokens || null,
    outputTokens: totalOutputTokens || null,
    aiModel,
    degradedChunks,
  };
}

// --- Summary Generation ---

const SUMMARY_PROMPT = `You are a blog editor for a church's weekly blog posts. Given a transcript from a church livestream video, generate two pieces of text:

1. "intro" — A single welcoming introductory paragraph (2-3 sentences) that introduces the blog post to readers. It should mention the topic or theme of the sermon/service and invite the reader to watch or read along.

2. "summary" — A 1-2 paragraph summary of the key points, themes, and messages from the transcript. This should give readers a meaningful overview of the content without being too detailed.

Return a JSON object with "intro" and "summary" fields. Both should be plain text (no HTML).
Return ONLY the JSON object. No explanation, no markdown fences.`;

function parseSummaryResponse(
  content: string
): { intro: string; summary: string } | null {
  const tryParse = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (
        parsed &&
        typeof parsed === "object" &&
        ("intro" in parsed || "summary" in parsed)
      ) {
        return {
          intro: String(parsed.intro || ""),
          summary: String(parsed.summary || ""),
        };
      }
    } catch {
      // continue
    }
    return null;
  };

  let result = tryParse(content);
  if (result) return result;

  // Strip markdown fences
  const stripped = content.trim();
  if (stripped.startsWith("```")) {
    const lines = stripped.split("\n");
    const inner = lines
      .slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined)
      .join("\n");
    result = tryParse(inner);
    if (result) return result;
  }

  // Regex extract {...}
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    result = tryParse(match[0]);
    if (result) return result;
  }

  return null;
}

export async function generateSummary(
  paragraphs: Paragraph[]
): Promise<SummaryResult> {
  const condensed = paragraphs.map((p) => p.text).join("\n\n");
  const words = condensed.split(/\s+/);
  const truncated =
    words.length > 4000 ? words.slice(0, 4000).join(" ") + "..." : condensed;

  try {
    const openai = getOpenAIClient();
    const response = await withRetries(
      () =>
        openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: SUMMARY_PROMPT },
            { role: "user", content: truncated },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      3,
      "summary"
    );

    const tokensUsed = response.usage?.total_tokens ?? null;
    const inputTokens = response.usage?.prompt_tokens ?? null;
    const outputTokens = response.usage?.completion_tokens ?? null;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("[ai-cleanup] Summary response had no content");
      return { intro: "", summary: "", tokensUsed, inputTokens, outputTokens };
    }

    const parsed = parseSummaryResponse(content);
    if (!parsed) {
      console.error(
        `[ai-cleanup] Failed to parse summary response: ${content.slice(0, 200)}`
      );
      return { intro: "", summary: "", tokensUsed, inputTokens, outputTokens };
    }

    return { ...parsed, tokensUsed, inputTokens, outputTokens };
  } catch (error) {
    console.error("Summary generation failed:", error);
    return {
      intro: "",
      summary: "",
      tokensUsed: null,
      inputTokens: null,
      outputTokens: null,
    };
  }
}
