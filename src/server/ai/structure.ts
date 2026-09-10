import { getOpenAIClient, MODEL } from "./openai";
import { formatTimestamp, withRetries, type Paragraph } from "./cleanup";

/**
 * One section of the finished post: a heading, the paragraph it starts at,
 * and the point in the video that paragraph came from.
 */
export interface Section {
  /** Index into the cleaned paragraph array where this section begins. */
  startIndex: number;
  heading: string;
  timestamp: number;
}

export interface StructureResult {
  /** A post title drawn from the content, or null to keep the video's title. */
  title: string | null;
  sections: Section[];
  tokensUsed: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** Words of each paragraph shown to the model when it picks section breaks. */
const PREVIEW_WORDS = 30;

/**
 * Guard rails on the returned outline. A section every few paragraphs is what
 * makes a wall of transcript skimmable; one every paragraph is just noise, and
 * two for a 45-minute sermon is no better than none.
 */
const MIN_PARAGRAPHS_PER_SECTION = 3;
const MAX_HEADING_CHARS = 80;

const STRUCTURE_PROMPT = `You are a blog editor preparing a church service transcript for publication.

You will receive a numbered list of transcript paragraphs, each with its timestamp and opening words.

Produce two things:

1. "title" — A clear, specific title for the blog post, drawn from what the sermon is actually about. Prefer the preacher's own theme or scripture over a generic label. Title Case, no quotation marks, no trailing punctuation, under 80 characters. Do not include a date or the words "sermon", "service", or "livestream" unless the content genuinely calls for them.

2. "sections" — Section headings that break the transcript into readable parts. Each section marks where a new part of the service or a new movement in the sermon begins: for example the welcome, the scripture reading, each major point of the message, and the closing or benediction.

Rules for sections:
- Return an object per section with "startIndex" (the paragraph number the section begins at) and "heading" (the section title).
- The first section MUST have startIndex 0.
- startIndex values must strictly increase, and each section should cover at least ${MIN_PARAGRAPHS_PER_SECTION} paragraphs.
- Aim for a section roughly every 5 to 12 paragraphs. A long service should end up with somewhere between 4 and 12 sections.
- Headings are short descriptive phrases in Title Case, under ${MAX_HEADING_CHARS} characters. No numbering, no timestamps, no trailing punctuation.
- Base every heading on what is actually said in that part of the transcript. Never invent content.

Return ONLY a JSON object with "title" and "sections". No explanation, no markdown fences.`;

function parseJsonObject(content: string): Record<string, unknown> | null {
  const tryParse = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through to the next strategy
    }
    return null;
  };

  const direct = tryParse(content);
  if (direct) return direct;

  const stripped = content.trim();
  if (stripped.startsWith("```")) {
    const lines = stripped.split("\n");
    const inner = lines
      .slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined)
      .join("\n");
    const fenced = tryParse(inner);
    if (fenced) return fenced;
  }

  const match = content.match(/\{[\s\S]*\}/);
  if (match) return tryParse(match[0]);

  return null;
}

export function cleanHeading(raw: string): string | null {
  let heading = raw
    .trim()
    // Models like to re-add the structure we asked them to leave out. Wrapping
    // quotes come off first, so the prefixes they hide are still anchored.
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–—:]?\s*/, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[.,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!heading) return null;
  if (heading.length > MAX_HEADING_CHARS) {
    heading = heading.slice(0, MAX_HEADING_CHARS).trimEnd().replace(/[,;:-]$/, "");
  }
  return heading;
}

/**
 * Normalize whatever the model returned into an outline we can safely index
 * paragraphs with: in range, strictly increasing, not bunched up, and always
 * opening at paragraph 0 so no text ends up above the first heading.
 */
export function normalizeSections(
  raw: unknown,
  paragraphs: Paragraph[]
): Section[] {
  if (!Array.isArray(raw)) return [];

  const candidates: { startIndex: number; heading: string }[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const startIndex = Number(record.startIndex);
    const heading = cleanHeading(String(record.heading ?? ""));
    if (!heading) continue;
    if (!Number.isFinite(startIndex)) continue;
    const index = Math.floor(startIndex);
    if (index < 0 || index >= paragraphs.length) continue;
    candidates.push({ startIndex: index, heading });
  }

  candidates.sort((a, b) => a.startIndex - b.startIndex);

  const sections: Section[] = [];
  for (const candidate of candidates) {
    const previous = sections[sections.length - 1];
    if (
      previous &&
      candidate.startIndex - previous.startIndex < MIN_PARAGRAPHS_PER_SECTION
    ) {
      continue;
    }
    if (
      previous &&
      previous.heading.toLowerCase() === candidate.heading.toLowerCase()
    ) {
      continue;
    }
    sections.push({
      startIndex: candidate.startIndex,
      heading: candidate.heading,
      timestamp: paragraphs[candidate.startIndex].timestamp,
    });
  }

  if (sections.length === 0) return [];

  // Anything before the first heading would render as an orphaned block, so
  // pull that heading up to the top rather than dropping the text.
  if (sections[0].startIndex !== 0) {
    sections[0] = {
      ...sections[0],
      startIndex: 0,
      timestamp: paragraphs[0].timestamp,
    };
  }

  return sections;
}

export function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const title = raw
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title || title.length > 120) return null;
  return title;
}

/**
 * Ask the model for a post title and a section outline over already-cleaned
 * paragraphs. Failure is non-fatal: the caller keeps the video's title and an
 * unsectioned draft, which is exactly what it produced before this step existed.
 */
export async function generateStructure(
  paragraphs: Paragraph[]
): Promise<StructureResult> {
  const empty: StructureResult = {
    title: null,
    sections: [],
    tokensUsed: null,
    inputTokens: null,
    outputTokens: null,
  };

  if (paragraphs.length < MIN_PARAGRAPHS_PER_SECTION * 2) return empty;

  const outline = paragraphs
    .map((p, i) => {
      const words = p.text.split(/\s+/);
      const preview =
        words.length > PREVIEW_WORDS
          ? words.slice(0, PREVIEW_WORDS).join(" ") + "..."
          : p.text;
      return `${i}. [${formatTimestamp(p.timestamp)}] ${preview}`;
    })
    .join("\n");

  try {
    const openai = getOpenAIClient();
    const response = await withRetries(
      () =>
        openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: STRUCTURE_PROMPT },
            { role: "user", content: outline },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      3,
      "structure"
    );

    const tokensUsed = response.usage?.total_tokens ?? null;
    const inputTokens = response.usage?.prompt_tokens ?? null;
    const outputTokens = response.usage?.completion_tokens ?? null;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("[ai-structure] Response had no content");
      return { ...empty, tokensUsed, inputTokens, outputTokens };
    }

    const parsed = parseJsonObject(content);
    if (!parsed) {
      console.error(
        `[ai-structure] Failed to parse response: ${content.slice(0, 200)}`
      );
      return { ...empty, tokensUsed, inputTokens, outputTokens };
    }

    return {
      title: cleanTitle(parsed.title),
      sections: normalizeSections(parsed.sections, paragraphs),
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  } catch (error) {
    console.error("[ai-structure] Structure generation failed:", error);
    return empty;
  }
}
