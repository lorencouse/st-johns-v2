/**
 * Turns a service's uploaded documents into one reference block for the AI
 * passes. The documents are what the church printed or the preacher wrote;
 * they are used to get spellings, Bible references and titles right, never as
 * a source of extra words for the post.
 */

export interface ReferenceDocument {
  kind: string;
  fileName: string;
  extractedText: string | null;
}

/**
 * Roughly 4,000 tokens. Every cleanup chunk carries the reference, so it is
 * kept small enough that a long service stays cheap.
 */
const REFERENCE_MAX_CHARS = 16_000;

const KIND_ORDER: Record<string, number> = { bulletin: 0, sermon: 1, other: 2 };
const KIND_HEADINGS: Record<string, string> = {
  bulletin: "Service bulletin",
  sermon: "Sermon text or notes",
  other: "Other document",
};

/**
 * Bulletins come first: they are short and carry the names, readings and hymn
 * titles. When everything does not fit, each document gets an equal share and
 * a short one hands what it does not use to the others.
 */
export function buildReferenceText(
  docs: ReferenceDocument[],
  maxChars = REFERENCE_MAX_CHARS
): string | null {
  const usable = docs
    .map((d) => ({ ...d, text: (d.extractedText ?? "").replace(/\s+\n/g, "\n").trim() }))
    .filter((d) => d.text.length > 0)
    .sort((a, b) => (KIND_ORDER[a.kind] ?? 3) - (KIND_ORDER[b.kind] ?? 3));
  if (usable.length === 0) return null;

  const headed = usable.map(
    (d) => `### ${KIND_HEADINGS[d.kind] ?? KIND_HEADINGS.other} (${d.fileName})\n`
  );
  let budget = maxChars - headed.reduce((sum, h) => sum + h.length + 2, 0);
  if (budget <= 0) return null;

  // Hand out the budget smallest-first so short documents are never cut.
  const shares = new Array<number>(usable.length).fill(0);
  const bySize = usable
    .map((d, i) => ({ i, len: d.text.length }))
    .sort((a, b) => a.len - b.len);
  bySize.forEach(({ i, len }, n) => {
    const fair = Math.floor(budget / (bySize.length - n));
    shares[i] = Math.min(len, fair);
    budget -= shares[i];
  });

  return usable
    .map((d, i) => {
      const cut = shares[i] < d.text.length;
      return headed[i] + (cut ? d.text.slice(0, shares[i]).trimEnd() + " [...]" : d.text);
    })
    .join("\n\n");
}

/**
 * Appends the reference to a system prompt with the rules for using it. With
 * no reference the prompt is returned unchanged, so a church that uploads
 * nothing gets exactly the draft it got before.
 */
export function withReference(systemPrompt: string, reference: string | null): string {
  if (!reference) return systemPrompt;
  return `${systemPrompt}

Reference documents from this service (the bulletin, sermon text or notes) follow below. Use them ONLY to get these right where the transcript garbles them: people's names, place names, Bible book names and verse numbers, hymn, song and reading titles, and church terms. The transcript is what was actually said: never copy sentences, paragraphs or content from the reference documents into your output, and never change what the speaker said to match the documents. If the transcript and the documents differ in wording, keep the transcript's wording.

<reference_documents>
${reference}
</reference_documents>`;
}
