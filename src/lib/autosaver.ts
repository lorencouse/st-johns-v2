export type Fields = Record<string, unknown>;

/** Fields to save, or a function that reads them when the save goes out. */
export type FieldSource = Fields | (() => Fields);

export interface SaveOptions {
  /** The page is going away, so the request has to outlive it. */
  unloading: boolean;
}

/** Sends the fields and resolves to whether they were saved. */
export type SaveFields = (fields: Fields, options: SaveOptions) => Promise<boolean>;

/**
 * Debounces saves without losing any: every field changed during the wait goes
 * out in one request, with later values winning. Fields from a failed save are
 * kept and go out with the next change.
 */
export function createAutosaver(save: SaveFields, delayMs: number) {
  let pending: FieldSource[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const inFlight = new Set<Promise<void>>();

  function send(options: SaveOptions) {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending.length === 0) return;

    const fields = pending.reduce<Fields>(
      (merged, source) => ({
        ...merged,
        ...(typeof source === "function" ? source() : source),
      }),
      {}
    );
    pending = [];

    const request: Promise<void> = save(fields, options)
      .catch(() => false)
      .then((saved) => {
        if (!saved) pending = [fields, ...pending];
      })
      .finally(() => {
        inFlight.delete(request);
      });
    inFlight.add(request);
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
    /** Sends anything waiting now, and resolves once every save has finished. */
    async flush(options: SaveOptions = { unloading: false }) {
      send(options);
      await Promise.all(inFlight);
    },
  };
}
