import { formatTimestamp, type Paragraph } from "@/server/ai/cleanup";
import type { Section } from "@/server/ai/structure";

/**
 * The draft body, flattened. Both the Tiptap document the editor round-trips
 * and the HTML/Markdown exports are built from this shape, so a heading added
 * by the AI and a heading typed by an editor export identically.
 */
export interface DocBlock {
  type: "heading" | "paragraph";
  text: string;
  /** Seconds into the source video, or null once an editor has added a block. */
  timestamp: number | null;
}

export const HEADING_LEVEL = 2;

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
}

export interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

function textNode(text: string) {
  return { type: "text" as const, text };
}

/**
 * Timestamps ride along as node attributes rather than as text, so retitling
 * a section or rewording a paragraph never disturbs the link back into the
 * video. `time` is the pre-formatted label the editor stylesheet displays.
 */
function timestampAttrs(timestamp: number | null) {
  if (timestamp === null) return { timestamp: null, time: null };
  return { timestamp, time: formatTimestamp(timestamp) };
}

export function blocksToContentJson(blocks: DocBlock[]): TiptapDoc {
  return {
    type: "doc",
    content: blocks.map((block) => ({
      type: block.type,
      attrs:
        block.type === "heading"
          ? { level: HEADING_LEVEL, ...timestampAttrs(block.timestamp) }
          : timestampAttrs(block.timestamp),
      content: block.text ? [textNode(block.text)] : [],
    })),
  };
}

/** Interleave the AI's section headings into the cleaned paragraph stream. */
export function buildBlocks(
  paragraphs: Paragraph[],
  sections: Section[]
): DocBlock[] {
  const headingAt = new Map<number, string>();
  for (const section of sections) {
    headingAt.set(section.startIndex, section.heading);
  }

  const blocks: DocBlock[] = [];
  paragraphs.forEach((paragraph, index) => {
    const heading = headingAt.get(index);
    if (heading) {
      blocks.push({
        type: "heading",
        text: heading,
        timestamp: paragraph.timestamp,
      });
    }
    blocks.push({
      type: "paragraph",
      text: paragraph.text,
      timestamp: paragraph.timestamp,
    });
  });
  return blocks;
}

export function blocksToPlainText(blocks: DocBlock[]): string {
  return blocks
    .map((block) => (block.type === "heading" ? `## ${block.text}` : block.text))
    .join("\n\n");
}

/**
 * Read the body back out of a Tiptap document. Editors can add blocks that
 * never came from the transcript, so a missing or unparseable timestamp is
 * normal and yields null rather than a misleading 0:00.
 */
export function blocksFromContentJson(doc: unknown): DocBlock[] {
  const content = (doc as TiptapDoc | null)?.content;
  if (!Array.isArray(content)) return [];

  const blocks: DocBlock[] = [];
  for (const node of content) {
    if (node?.type !== "paragraph" && node?.type !== "heading") continue;

    const text = (node.content || [])
      .map((child) => child.text ?? "")
      .join("")
      .trim();
    if (!text) continue;

    const raw = node.attrs?.timestamp;
    const timestamp =
      typeof raw === "number" && Number.isFinite(raw) ? raw : null;

    blocks.push({ type: node.type, text, timestamp });
  }
  return blocks;
}

export { TRANSCRIPT_DISCLAIMER } from "@/lib/disclaimer";
