"use client";

import { useCallback, useState } from "react";
import type { Spot, WordCheckStatus } from "./word-check-panel";

/** One piece of text to compare with the sermon and bulletin. */
interface CheckedParagraph {
  id: string;
  text: string;
}

/**
 * Compares words with the uploaded documents and tracks what became of each
 * suggestion. `getParagraphs` is read when a check starts, so it should stay
 * the same function between renders.
 */
export function useWordCheck({
  workspaceId,
  videoId,
  getParagraphs,
  initialStatus,
}: {
  workspaceId: string;
  videoId: string;
  getParagraphs: () => CheckedParagraph[];
  initialStatus: WordCheckStatus;
}) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [checkStatus, setCheckStatus] = useState<WordCheckStatus>(initialStatus);

  const runCheck = useCallback(async () => {
    setCheckStatus("checking");
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/videos/${videoId}/word-check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paragraphs: getParagraphs() }),
        }
      );
      if (!res.ok) throw new Error(String(res.status));
      const data: { suggestions: Omit<Spot, "key" | "state">[] } = await res.json();
      setSpots(
        data.suggestions.map((s, i) => ({ ...s, key: `${i}-${s.paragraphId}`, state: "open" }))
      );
      setCheckStatus("done");
    } catch {
      setCheckStatus("error");
    }
  }, [workspaceId, videoId, getParagraphs]);

  const setSpotState = useCallback((key: string, state: Spot["state"]) => {
    setSpots((prev) => prev.map((s) => (s.key === key ? { ...s, state } : s)));
  }, []);

  return { spots, checkStatus, runCheck, setSpotState };
}
