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
const MIN_SEGMENT_WORDS = 1;
const MIN_PARAGRAPH_WORDS = 8;

const AUDIO_MARKER_RE =
  /\[(?:music|applause|singing|music and singing|laughter|inaudible)\]/gi;

/** Non-global twin of AUDIO_MARKER_RE, safe for stateless .test() calls. */
const MUSIC_MARKER_RE = /\[(?:music|singing|music and singing)\]/i;

/** YouTube emits ">>" at a speaker change in its caption tracks. */
const SPEAKER_MARKER_RE = /^\s*>>/;

/**
 * Music markers closer together than this are treated as one continuous
 * musical item (a hymn), so that stray lyrics the ASR transcribes between
 * markers are dropped along with the markers themselves.
 */
const MUSIC_REGION_MERGE_SECONDS = 45;

/**
 * A caption segment annotated with structure we recovered before the
 * markers were stripped out of its text.
 */
export interface MarkedSegment extends CaptionSegment {
  /** This segment began with a ">>" speaker-change marker. */
  speakerBreak?: boolean;
}

/**
 * Filler removal is deliberately conservative: these run over sermon and
 * scripture text, where an unanchored rule quietly rewrites meaning.
 * ("right" removed anywhere turns "at the right hand of God" into "at the
 * hand of God"; "you know" removed anywhere turns "you know that God loves
 * you" into "that God loves you".) So every word that also has a literal
 * sense is only stripped where punctuation marks it as a discourse marker.
 * Genuine non-words (um, uh, ...) are stripped anywhere.
 */
const FILLER_PATTERNS: [RegExp, string][] = [
  // Hesitation sounds: never meaningful, safe to remove anywhere.
  [/\b(?:um|umm|uh|uhh|erm|hmm)\b[,]?\s*/gi, " "],

  // Discourse markers, only when set off by commas or starting a sentence.
  [/,\s*(?:you know|I mean|like|right|okay)\s*,/gi, ","],
  [/(?:^|(?<=[.?!]\s))(?:you know|I mean|like|okay|all right|so|well),\s+/gim, ""],

  // Tag questions are statements: "that is true, right?" -> "that is true."
  [/,\s*(?:right|okay)\s*\?/gi, "."],

  // Tidy punctuation left behind by the rules above.
  [/,\s*,/g, ","],
  [/\s+,/g, ","],
  [/(^|[.?!]\s*)(?:and|but|so),\s+/gi, "$1"],
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

/**
 * Words to allow in a paragraph that offers no sentence breaks to split on.
 * Some YouTube auto-caption tracks carry no punctuation at all, and when the
 * cleanup model falls back to the raw text there is not a single period in a
 * 3,000-word service. Sentence splitting then finds nothing, the paragraph
 * survives whole, and the structure pass sees too few paragraphs to place any
 * headings — 13 posts came out as one unbroken wall that way.
 */
const MAX_WORDS_PER_PARAGRAPH = 120;

/** Break on word count when there is no punctuation to break on. */
function splitUnpunctuated(
  text: string,
  timestamp: number,
  nextTimestamp?: number
): Paragraph[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS_PER_PARAGRAPH) return [{ timestamp, text }];

  const result: Paragraph[] = [];
  const totalChunks = Math.ceil(words.length / MAX_WORDS_PER_PARAGRAPH);
  const duration = nextTimestamp !== undefined ? nextTimestamp - timestamp : 0;

  for (let i = 0; i < words.length; i += MAX_WORDS_PER_PARAGRAPH) {
    const chunkIndex = Math.floor(i / MAX_WORDS_PER_PARAGRAPH);
    result.push({
      timestamp: Math.round(timestamp + (duration * chunkIndex) / totalChunks),
      text: words.slice(i, i + MAX_WORDS_PER_PARAGRAPH).join(" "),
    });
  }
  return result;
}

function splitLongParagraph(
  text: string,
  timestamp: number,
  nextTimestamp?: number
): Paragraph[] {
  const parts = text.split(/(?<=[.?!])\s+/);
  if (parts.length <= MAX_SENTENCES_PER_PARAGRAPH) {
    return splitUnpunctuated(text, timestamp, nextTimestamp);
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

/**
 * YouTube's auto-caption tracks use rolling captions: each cue's end time
 * runs past the next cue's start, so consecutive segments overlap. That
 * makes every inter-segment "gap" negative and silently defeats the
 * pause-based paragraph splitting in mergeIntoParagraphs. Clamping each
 * end to the following start restores real silence gaps.
 */
export function normalizeOverlaps(segments: CaptionSegment[]): CaptionSegment[] {
  return segments.map((seg, i) => {
    const next = segments[i + 1];
    if (!next || seg.end <= next.start) return seg;
    return { ...seg, end: Math.max(seg.start, next.start) };
  });
}

/**
 * Remove hymns and other sung/played sections.
 *
 * Music markers are clustered into regions (see MUSIC_REGION_MERGE_SECONDS)
 * and every segment fully contained in a region is dropped. This removes
 * both the markers and the fragments of sung lyrics that the ASR picks up
 * between them, which are noise in a written post and are frequently
 * copyrighted besides. Segments only partially overlapping a region are
 * kept, so speech near a boundary survives.
 */
export function stripMusicRegions(segments: CaptionSegment[]): CaptionSegment[] {
  const markers = segments.filter((seg) => MUSIC_MARKER_RE.test(seg.text));
  if (markers.length === 0) return segments;

  const regions: { start: number; end: number }[] = [];
  for (const marker of markers) {
    const last = regions[regions.length - 1];
    if (last && marker.start - last.end < MUSIC_REGION_MERGE_SECONDS) {
      last.end = Math.max(last.end, marker.end);
    } else {
      regions.push({ start: marker.start, end: marker.end });
    }
  }

  return segments.filter(
    (seg) =>
      !regions.some((r) => seg.start >= r.start && seg.end <= r.end)
  );
}

/**
 * Collapse runs of the identical line.
 *
 * Whisper repeats a line when audio is sustained or sung, so a refrain comes
 * back as the same sentence several times over. Keeping the first occurrence
 * preserves the content while dropping the stutter. Note this is a transcription
 * artifact only: it is not a substitute for music-section removal, which
 * stripMusicRegions handles for caption tracks that carry [music] markers.
 */
export function collapseRepeats(segments: CaptionSegment[]): CaptionSegment[] {
  const normalize = (text: string) =>
    text.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");

  const result: CaptionSegment[] = [];
  for (const seg of segments) {
    const previous = result[result.length - 1];
    if (previous && normalize(previous.text) === normalize(seg.text)) {
      // Extend the kept segment over the repeat rather than leaving a gap.
      previous.end = Math.max(previous.end, seg.end);
      continue;
    }
    result.push({ ...seg });
  }
  return result;
}

export function filterNoise(segments: CaptionSegment[]): MarkedSegment[] {
  return collapseRepeats(stripMusicRegions(normalizeOverlaps(segments)))
    .map((seg) => ({
      ...seg,
      speakerBreak: SPEAKER_MARKER_RE.test(seg.text),
      text: stripMarkers(seg.text),
    }))
    .filter((seg) => seg.text && wordCount(seg.text) >= MIN_SEGMENT_WORDS);
}

export function mergeIntoParagraphs(
  segments: MarkedSegment[],
  gapThreshold = PARAGRAPH_GAP_SECONDS
): Paragraph[] {
  if (segments.length === 0) return [];

  const rawParagraphs: Paragraph[] = [];
  let currentTexts = [segments[0].text];
  let currentTimestamp = segments[0].start;

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap > gapThreshold || segments[i].speakerBreak) {
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

/**
 * Re-derive paragraph timestamps from the source segments.
 *
 * The cleanup prompt asks the model to "preserve the approximate timestamps",
 * and it does not: on the second and later chunks of a long service it
 * restarts its numbering near zero, so section markers march backwards
 * partway down the post. Model-supplied timestamps are therefore discarded
 * outright and rebuilt here.
 *
 * Cleaned text is a near-verbatim, slightly shortened rendering of its source,
 * so a paragraph's position by word count maps closely onto the same position
 * in the segment timeline. Anchoring that way is monotonic by construction and
 * stays inside the chunk's real time span, which the model's numbers did not.
 */
export function anchorParagraphTimestamps(
  paragraphs: Paragraph[],
  segments: CaptionSegment[]
): Paragraph[] {
  if (paragraphs.length === 0 || segments.length === 0) return paragraphs;

  // Cumulative source words, so a word offset can be resolved to a segment.
  const boundaries: { wordsBefore: number; start: number }[] = [];
  let sourceWords = 0;
  for (const segment of segments) {
    boundaries.push({ wordsBefore: sourceWords, start: segment.start });
    sourceWords += wordCount(segment.text);
  }
  if (sourceWords === 0) return paragraphs;

  const outputWords = paragraphs.reduce((sum, p) => sum + wordCount(p.text), 0);
  if (outputWords === 0) return paragraphs;

  const startAtWord = (target: number) => {
    let low = 0;
    let high = boundaries.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (boundaries[mid].wordsBefore <= target) low = mid;
      else high = mid - 1;
    }
    return boundaries[low].start;
  };

  let consumed = 0;
  return paragraphs.map((paragraph) => {
    const target = Math.floor((consumed / outputWords) * sourceWords);
    consumed += wordCount(paragraph.text);
    return { timestamp: Math.round(startAtWord(target)), text: paragraph.text };
  });
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

  const parsed = parseCleanupResponse(content, fallbackParagraphs);

  let paragraphs = parsed.map((p) => ({
    timestamp: p.timestamp,
    text: fixPunctuation(removeFillerWords(p.text)),
  }));

  // The fallback already carries exact segment times; only the model's own
  // timestamps need rebuilding.
  if (parsed !== fallbackParagraphs) {
    paragraphs = anchorParagraphTimestamps(paragraphs, filtered);
  }

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

export async function withRetries<T>(
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
