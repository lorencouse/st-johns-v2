import { formatTimestamp } from "@/server/ai/cleanup";
import {
  TRANSCRIPT_DISCLAIMER,
  type DocBlock,
} from "@/server/content/document";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function watchUrl(videoId: string, timestamp: number | null): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return timestamp === null ? base : `${base}&t=${Math.floor(timestamp)}s`;
}

export function renderHtml(
  videoId: string,
  blocks: DocBlock[],
  options?: {
    intro?: string | null;
    summary?: string | null;
    title?: string | null;
    // Squarespace (and most rich-text editors) drop iframes out of a pasted
    // document, so the copy-to-clipboard flavour asks for a plain link and
    // lets the editor place a real video block instead.
    embed?: "iframe" | "link";
  }
): string {
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  let introSection = "";
  if (options?.intro) {
    introSection += `<p>${escapeHtml(options.intro)}</p>\n\n`;
  }
  if (options?.summary) {
    const summaryParagraphs = options.summary.split(/\n\n+/).filter(Boolean);
    introSection +=
      summaryParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n") +
      "\n\n";
  }

  // Section headings carry a timestamp link back into the video; body
  // paragraphs stay clean so the post reads as prose rather than as a log.
  const bodyHtml = blocks
    .map((block) => {
      const text = escapeHtml(block.text);
      if (block.type !== "heading") return `<p>${text}</p>`;
      if (block.timestamp === null) return `<h2>${text}</h2>`;
      const link = `<a href="${watchUrl(videoId, block.timestamp)}">${formatTimestamp(block.timestamp)}</a>`;
      return `<h2>${text} <small>${link}</small></h2>`;
    })
    .join("\n");

  const titleSection = options?.title
    ? `<h1>${escapeHtml(options.title)}</h1>\n\n`
    : "";

  const embedSection =
    options?.embed === "link"
      ? `<p><a href="${watchUrl(videoId, null)}">Watch this sermon on YouTube</a></p>`
      : `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
  <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>`;

  return `${titleSection}${introSection}${embedSection}

<hr>

<h2>Transcript</h2>

<p><em>${escapeHtml(TRANSCRIPT_DISCLAIMER)}</em></p>

${bodyHtml}`;
}

export function renderMarkdown(
  videoId: string,
  blocks: DocBlock[],
  options?: {
    intro?: string | null;
    summary?: string | null;
    title?: string | null;
  }
): string {
  const parts: string[] = [];

  if (options?.title) {
    parts.push(`# ${options.title}\n`);
  }

  if (options?.intro) {
    parts.push(options.intro + "\n");
  }

  if (options?.summary) {
    parts.push(options.summary + "\n");
  }

  parts.push(
    `[![Watch on YouTube](https://img.youtube.com/vi/${videoId}/0.jpg)](https://www.youtube.com/watch?v=${videoId})\n`
  );
  parts.push("---\n");
  parts.push("## Transcript\n");
  parts.push(`_${TRANSCRIPT_DISCLAIMER}_\n`);

  for (const block of blocks) {
    if (block.type === "heading") {
      const anchor =
        block.timestamp === null
          ? ""
          : ` [${formatTimestamp(block.timestamp)}](${watchUrl(videoId, block.timestamp)})`;
      parts.push(`### ${block.text}${anchor}\n`);
    } else {
      parts.push(`${block.text}\n`);
    }
  }

  return parts.join("\n");
}
