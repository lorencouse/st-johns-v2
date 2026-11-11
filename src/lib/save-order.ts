/**
 * Keeps an older autosave from landing over a newer one.
 *
 * Each studio page numbers its saves in the order it sends them. When the page
 * closes, a save already on its way can still reach the server after the
 * request that carries the newer edits, and so can a save the page gave up
 * waiting for. The server keeps the stamp of the last save it wrote and skips
 * any save from the same page with a lower or equal number.
 *
 * Saves from different pages (another tab, another person, a reload) carry
 * different sessions and are not ordered against each other: the last to
 * arrive wins, as before.
 */
export interface SaveStamp {
  /** One id per studio page, so its numbers are only compared with each other. */
  session: string;
  /** Goes up by one with each save the page sends. */
  seq: number;
}

/** Key under a draft's `metadataJson` that holds the last written stamp. */
export const SAVE_STAMP_KEY = "lastAutosave";

/** Reads a stamp from a request body or stored metadata; null if it is not one. */
export function parseSaveStamp(value: unknown): SaveStamp | null {
  if (!value || typeof value !== "object") return null;
  const { session, seq } = value as Record<string, unknown>;
  if (typeof session !== "string" || session.length === 0 || session.length > 100) {
    return null;
  }
  if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return null;
  return { session, seq };
}

/** Whether a save is older than one already written from the same page. */
export function isStaleSave(stored: SaveStamp | null, incoming: SaveStamp | null): boolean {
  if (!stored || !incoming) return false;
  return stored.session === incoming.session && incoming.seq <= stored.seq;
}
