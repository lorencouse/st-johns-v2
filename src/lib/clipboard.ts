/**
 * Clipboard helpers for handing exported content to a CMS.
 *
 * Squarespace's text block pastes the `text/html` flavour of the clipboard, so
 * writing rich HTML there is what makes a paste arrive preformatted instead of
 * as visible markup.
 */

/** Writes HTML as both the rich and plain-text clipboard flavours. */
export async function writeRichHtml(html: string, plain: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  }

  // Browsers without ClipboardItem: a selection copy still carries the rich
  // flavour, which is the part that matters for pasting into a CMS.
  const holder = document.createElement("div");
  holder.innerHTML = html;
  holder.setAttribute("contenteditable", "true");
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.execCommand("copy");
  selection?.removeAllRanges();
  holder.remove();
}

/** Strips tags for the plain-text flavour that accompanies a rich copy. */
export function htmlToPlainText(html: string): string {
  return (
    new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""
  );
}

/** Copies a stored export artifact: HTML rich, everything else verbatim. */
export async function copyArtifactToClipboard(
  bodyText: string,
  format: string
) {
  if (format === "html") {
    await writeRichHtml(bodyText, htmlToPlainText(bodyText));
    return;
  }
  await navigator.clipboard.writeText(bodyText);
}
