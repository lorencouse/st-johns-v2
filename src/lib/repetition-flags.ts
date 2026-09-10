/**
 * Flags passages that look sung rather than spoken.
 *
 * YouTube's caption tracks mark music with [music], which the ingest pipeline
 * uses to remove hymns outright. Whisper emits no such marker, so for
 * Whisper-transcribed videos the hymns arrive as ordinary text — typically
 * with verses and refrains repeating.
 *
 * This only ever flags for human review; nothing is deleted on its strength.
 * Repetition alone cannot separate a hymn from a spoken call-and-response
 * liturgy or a preacher's deliberate refrain, and silently dropping either of
 * those would be worse than leaving a passage in.
 */

/** Below this, a passage is too short for repetition to mean anything. */
const MIN_CLAUSES = 4;

/**
 * Share of clauses that must be repeats before the passage is flagged.
 * Tuned against the caption-sourced corpus, where hymns have already been
 * removed upstream, so anything it flags there is a false positive: rhetorical
 * repetition is a deliberate preaching device and must not trip this.
 */
const REPEAT_SHARE_THRESHOLD = 0.45;

/** A phrase this many words long, recurring this often, is also a signal. */
const NGRAM_SIZE = 6;
const NGRAM_MIN_OCCURRENCES = 4;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split into clauses, since sung lines break at commas as often as periods. */
function toClauses(text: string): string[] {
  return text
    .split(/[.!?,;:]+/)
    .map((clause) => normalize(clause))
    .filter((clause) => clause.split(" ").length >= 3);
}

function repeatedClauseShare(clauses: string[]): number {
  if (clauses.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const clause of clauses) {
    counts.set(clause, (counts.get(clause) ?? 0) + 1);
  }
  let repeated = 0;
  for (const count of counts.values()) {
    if (count > 1) repeated += count;
  }
  return repeated / clauses.length;
}

function hasRecurringPhrase(text: string): boolean {
  const words = normalize(text).split(" ");
  if (words.length < NGRAM_SIZE * NGRAM_MIN_OCCURRENCES) return false;

  const counts = new Map<string, number>();
  for (let i = 0; i + NGRAM_SIZE <= words.length; i++) {
    const phrase = words.slice(i, i + NGRAM_SIZE).join(" ");
    const next = (counts.get(phrase) ?? 0) + 1;
    if (next >= NGRAM_MIN_OCCURRENCES) return true;
    counts.set(phrase, next);
  }
  return false;
}

/**
 * True when a passage repeats itself enough to be worth a reviewer's eye.
 * Intended for transcripts from Whisper; caption-sourced transcripts have
 * already had their music sections removed upstream.
 */
export function looksSung(text: string): boolean {
  const clauses = toClauses(text);
  if (clauses.length >= MIN_CLAUSES) {
    if (repeatedClauseShare(clauses) >= REPEAT_SHARE_THRESHOLD) return true;
  }
  return hasRecurringPhrase(text);
}
