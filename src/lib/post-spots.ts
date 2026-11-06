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
  for (const run of runs) {
    const runEnd = offset + run.text.length;
    if (from === null && start < runEnd) from = run.pos + (start - offset);
    if (to === null && end <= runEnd) to = run.pos + (end - offset);
    offset = runEnd;
    if (from !== null && to !== null) break;
  }
  return from !== null && to !== null ? { from, to } : null;
}

/** Ids for the post's plain fields in a word check; body blocks are `b<index>`. */
export const POST_FIELD_IDS = ["title", "intro", "summary"] as const;
export type PostFieldId = (typeof POST_FIELD_IDS)[number];

export function isPostField(id: string): id is PostFieldId {
  return (POST_FIELD_IDS as readonly string[]).includes(id);
}

export function blockIndexFromId(id: string): number | null {
  const m = /^b(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}
