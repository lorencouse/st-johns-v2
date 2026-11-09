"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAutosaver, type FieldSource, type SaveFields } from "@/lib/autosaver";

const AUTOSAVE_DELAY_MS = 800;
/** Browsers refuse a keepalive request over 64 KiB. */
const KEEPALIVE_MAX_BYTES = 60_000;

/** Saves a draft's edits shortly after they are made, and before leaving the page. */
export function useDraftAutosave({
  workspaceId,
  projectId,
  draftId,
  enabled,
}: {
  workspaceId: string;
  projectId: string;
  draftId: string | null;
  enabled: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saverRef = useRef<ReturnType<typeof createAutosaver> | null>(null);

  useEffect(() => {
    if (!draftId || !enabled) return;

    const save: SaveFields = async (fields, { unloading }) => {
      const body = JSON.stringify({ draftVersionId: draftId, ...fields });
      setSaving(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/drafts`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive:
              unloading && new TextEncoder().encode(body).length <= KEEPALIVE_MAX_BYTES,
          }
        );
        setSaveFailed(!res.ok);
        return res.ok;
      } catch {
        // Editing continues locally; the next change retries the save.
        setSaveFailed(true);
        return false;
      } finally {
        setSaving(false);
      }
    };

    const saver = createAutosaver(save, AUTOSAVE_DELAY_MS);
    saverRef.current = saver;
    const flushOnPageHide = () => void saver.flush({ unloading: true });
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      window.removeEventListener("pagehide", flushOnPageHide);
      void saver.flush();
      saverRef.current = null;
    };
  }, [workspaceId, projectId, draftId, enabled]);

  const queue = useCallback((source: FieldSource) => {
    saverRef.current?.queue(source);
  }, []);
  const isDirty = useCallback(() => saverRef.current?.isDirty() ?? false, []);
  const flush = useCallback(async () => {
    await saverRef.current?.flush();
  }, []);

  return { saving, saveFailed, queue, isDirty, flush };
}
