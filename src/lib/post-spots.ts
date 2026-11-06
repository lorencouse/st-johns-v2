/**
 * Finding a word-check spot inside the post editor. The editor stores a
 * paragraph as several text runs (bold, italic and plain text are separate
 * runs), so a phrase can start in one run and end in another. Each run knows
 * where it sits in the document; this maps a phrase in the paragraph's plain
 * text back to document positions.
 */
export interface TextRun {
  text: string;
  /** Document position of the run's first character. */
  pos: number;
}

export function locateText(
  runs: TextRun[],
  original: string
): { from: number; to: number } | null {
  if (!original) return null;
  const full = runs.map((r) => r.text).join("");
  const start = full.indexOf(original);
  if (start === -1) return null;
  const end = start + original.length;

  let offset = 0;
  let from: number | null = null;
  let to: number | null = null;
  let prevEnd: number | null = null;
  for (const run of runs) {
    const runEnd = offset + run.text.length;
    if (from !== null && prevEnd !== run.pos) return null;
    if (from === null && start < runEnd) from = run.pos + (start - offset);
    if (to === null && end <= runEnd) to = run.pos + (end - offset);
    offset = runEnd;
    prevEnd = run.pos + run.text.length;
    if (from !== null && to !== null) break;
  }
  return from !== null && to !== null ? { from, to } : null;
}

/** Ids for the post's plain fields in a word check; body textblocks are `b<k>`, counted in document order. */
export const POST_FIELD_IDS = ["title", "intro", "summary"] as const;
export type PostFieldId = (typeof POST_FIELD_IDS)[number];

export function isPostField(id: string): id is PostFieldId {
  return (POST_FIELD_IDS as readonly string[]).includes(id);
}

export function blockIndexFromId(id: string): number | null {
  const m = /^b(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/**
 * The part of a fix that actually changes: the words shared at the start and
 * end of `original` and `suggestion` are left out, so only the differing
 * middle is replaced and unchanged words keep their own formatting. `start`
 * and `end` are offsets into `original`; null when nothing differs.
 */
export function changedPart(
  original: string,
  suggestion: string
): { start: number; end: number; text: string } | null {
  if (original === suggestion) return null;
  const max = Math.min(original.length, suggestion.length);
  let prefix = 0;
  while (prefix < max && original[prefix] === suggestion[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < max - prefix &&
    original[original.length - 1 - suffix] === suggestion[suggestion.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    start: prefix,
    end: original.length - suffix,
    text: suggestion.slice(prefix, suggestion.length - suffix),
  };
}
