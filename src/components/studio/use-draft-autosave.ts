"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAutosaver, type FieldSource, type SaveFields } from "@/lib/autosaver";

const AUTOSAVE_DELAY_MS = 800;
/** Browsers refuse a keepalive request over 64 KiB. */
const KEEPALIVE_MAX_BYTES = 60_000;
/** A save that has not answered by now counts as failed, so nothing waits on it forever. */
const SAVE_TIMEOUT_MS = 15_000;
/** How long to wait before each retry when the studio closes with edits unsaved. */
const CLOSE_RETRY_DELAYS_MS = [1_000, 3_000];

/** Where leaving the studio is up to, when edits had to be saved first. */
export type LeaveState = "idle" | "saving" | "failed";

/** A click on a link that would take the person to another page of the app. */
function inAppLinkTarget(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return null;
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download")) return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page, another spot on it.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return null;
  }
  return url.pathname + url.search + url.hash;
}

/**
 * Saves a draft's edits shortly after they are made, and before leaving the
 * page. Links to other pages of the app wait for the edits to save, and stay
 * put with `leaveState` "failed" if they cannot be saved.
 */
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
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [leaveState, setLeaveState] = useState<LeaveState>("idle");
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
            signal: unloading ? undefined : AbortSignal.timeout(SAVE_TIMEOUT_MS),
          }
        );
        setSaveFailed(!res.ok);
        return res.ok;
      } catch {
        // Offline, or no answer in time. Editing continues locally; the next
        // change retries the save.
        setSaveFailed(true);
        return false;
      } finally {
        setSaving(false);
      }
    };

    const saver = createAutosaver(save, AUTOSAVE_DELAY_MS);
    saverRef.current = saver;
    const flushOnPageHide = () => void saver.flush({ unloading: true });
    // A request leaving with the page may not arrive (a body too big for
    // keepalive, or no connection), so the browser asks before closing.
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      if (!saver.isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("pagehide", flushOnPageHide);
    window.addEventListener("beforeunload", warnOnUnload);
    return () => {
      window.removeEventListener("pagehide", flushOnPageHide);
      window.removeEventListener("beforeunload", warnOnUnload);
      saverRef.current = null;
      // Leaving without a link (the back button, say): keep trying for a
      // little while, and say so if the edits still could not be saved.
      void (async () => {
        for (const delay of [0, ...CLOSE_RETRY_DELAYS_MS]) {
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          if (await saver.flush()) return;
        }
        window.alert(
          "Your latest edits to the post could not be saved. Open the post again to check it and redo them."
        );
      })();
    };
  }, [workspaceId, projectId, draftId, enabled]);

  const queue = useCallback((source: FieldSource) => {
    saverRef.current?.queue(source);
    setLeaveState((state) => (state === "failed" ? "idle" : state));
  }, []);
  const isDirty = useCallback(() => saverRef.current?.isDirty() ?? false, []);
  /** Resolves to whether every edit reached the server. */
  const flush = useCallback(async () => (await saverRef.current?.flush()) ?? true, []);

  /** Saves any edits, then goes to `href`; stays here if the save fails. */
  const leaveTo = useCallback(
    async (href: string) => {
      if (isDirty()) {
        setLeaveState("saving");
        if (!(await flush())) {
          setLeaveState("failed");
          return;
        }
      }
      setLeaveState("idle");
      router.push(href);
    },
    [flush, isDirty, router]
  );

  // Every link to another page waits for the edits, however it is styled.
  useEffect(() => {
    if (!draftId || !enabled) return;
    const holdLinks = (event: MouseEvent) => {
      const href = inAppLinkTarget(event);
      if (!href || !isDirty()) return;
      event.preventDefault();
      void leaveTo(href);
    };
    // Capture runs before the link's own handler, which then sees the click
    // was handled.
    document.addEventListener("click", holdLinks, true);
    return () => document.removeEventListener("click", holdLinks, true);
  }, [draftId, enabled, isDirty, leaveTo]);

  const dismissLeave = useCallback(() => setLeaveState("idle"), []);

  return { saving, saveFailed, queue, isDirty, flush, leaveState, dismissLeave };
}
