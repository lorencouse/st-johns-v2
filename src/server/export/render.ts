import type { Paragraph } from "@/server/ai/cleanup";
import { formatTimestamp } from "@/server/ai/cleanup";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderHtml(
  videoId: string,
  paragraphs: Paragraph[],
  options?: { intro?: string | null; summary?: string | null }
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

  const transcriptHtml = paragraphs
    .map((p) => {
      const ts = formatTimestamp(p.timestamp);
      return `<p><strong>[${ts}]</strong> ${escapeHtml(p.text)}</p>`;
    })
    .join("\n");

  return `${introSection}<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
  <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>

<hr>

<h2>Transcript</h2>

${transcriptHtml}`;
}

export function renderMarkdown(
  videoId: string,
  paragraphs: Paragraph[],
  options?: { intro?: string | null; summary?: string | null; title?: string | null }
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

  parts.push(`[![Watch on YouTube](https://img.youtube.com/vi/${videoId}/0.jpg)](https://www.youtube.com/watch?v=${videoId})\n`);
  parts.push("---\n");
  parts.push("## Transcript\n");

  for (const p of paragraphs) {
    const ts = formatTimestamp(p.timestamp);
    parts.push(`**[${ts}]** ${p.text}\n`);
  }

  return parts.join("\n");
}
