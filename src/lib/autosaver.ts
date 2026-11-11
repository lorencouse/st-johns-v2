export type Fields = Record<string, unknown>;

/** Fields to save, or a function that reads them when the save goes out. */
export type FieldSource = Fields | (() => Fields);

export interface SaveOptions {
  /** The page is going away, so the request has to outlive it. */
  unloading: boolean;
}

export interface SaveRequest extends SaveOptions {
  /**
   * Goes up by one with each request, so the server can skip a request that
   * arrives after a later one (see `src/lib/save-order.ts`).
   */
  seq: number;
}

/** Sends the fields and resolves to whether they were saved. */
export type SaveFields = (fields: Fields, request: SaveRequest) => Promise<boolean>;

/**
 * Debounces saves without losing any: every field changed during the wait goes
 * out in one request, with later values winning. Fields from a failed save are
 * kept and go out with the next change.
 *
 * Saves go out one at a time, so an older value can never land after a newer
 * one. The exception is a page that is unloading: then everything not yet
 * saved, including what is still in flight, goes out at once in a request that
 * can outlive the page. A failed save only puts back the fields no later save
 * has sent. Each request carries a number that goes up, so the server can skip
 * an older request that lands after the one sent on unload.
 */
export function createAutosaver(save: SaveFields, delayMs: number) {
  let pending: FieldSource[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Requests on their way, in the order they were sent. */
  const inFlight = new Map<Promise<void>, Fields>();
  /** The number of the last request that sent each field. */
  const lastSent = new Map<string, number>();
  let seq = 0;
  let sendWhenIdle = false;

  function send(options: SaveOptions) {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!options.unloading && inFlight.size > 0) {
      // Wait for the save on its way, so this one cannot overtake it.
      if (pending.length > 0) sendWhenIdle = true;
      return;
    }
    // When unloading, a request already on its way may not outlive the page,
    // so its fields go out again with this one.
    const resent = options.unloading ? [...inFlight.values()] : [];
    if (pending.length === 0 && resent.length === 0) return;
    const fields = [...resent, ...pending].reduce<Fields>(
      (merged, source) => ({
        ...merged,
        ...(typeof source === "function" ? source() : source),
      }),
      {}
    );
    pending = [];

    const id = ++seq;
    for (const key of Object.keys(fields)) lastSent.set(key, id);

    const request: Promise<void> = save(fields, { ...options, seq: id })
      .catch(() => false)
      .then((saved) => {
        if (saved) return;
        // Fields a later request sent are that request's to save.
        const unsent = Object.fromEntries(
          Object.entries(fields).filter(([key]) => lastSent.get(key) === id)
        );
        if (Object.keys(unsent).length > 0) pending = [unsent, ...pending];
      })
      .finally(() => {
        inFlight.delete(request);
        if (inFlight.size === 0 && sendWhenIdle) {
          sendWhenIdle = false;
          send({ unloading: false });
        }
      });
    inFlight.set(request, fields);
  }

  return {
    queue(source: FieldSource) {
      pending.push(source);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => send({ unloading: false }), delayMs);
    },
    /** True while a change has not reached the server yet. */
    isDirty() {
      return pending.length > 0 || inFlight.size > 0;
    },
    /**
     * Sends anything waiting now, and resolves once every save has finished:
     * true if every change reached the server, false if some are still unsaved.
     */
    async flush(options: SaveOptions = { unloading: false }) {
      send(options);
      while (inFlight.size > 0) {
        // A save that waited for the one ahead of it starts as that one ends.
        await Promise.all(inFlight.keys());
      }
      return pending.length === 0;
    },
  };
}
