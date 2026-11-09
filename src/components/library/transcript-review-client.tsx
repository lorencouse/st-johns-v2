"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  Undo2,
  Scissors,
  Sparkles,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { formatTimestampMs } from "@/lib/format";
import { flagContent } from "@/lib/content-flags";
import { looksSung } from "@/lib/repetition-flags";
import { RunStatus } from "@/components/studio/run-status";
import { BlockControls } from "@/components/library/block-controls";
import { ServiceSteps } from "@/components/service/service-steps";
import { serviceStepHref } from "@/lib/service-steps";
import { applySpot } from "@/lib/word-spots";
import { WordCheckPanel, type Spot } from "@/components/service/word-check-panel";
import { useWordCheck } from "@/components/service/use-word-check";

interface Segment {
  seq: number;
  startMs: number;
  endMs: number;
  text: string;
}

interface ParagraphBlock {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

interface TranscriptReviewClientProps {
  workspaceId: string;
  workspaceSlug: string;
  videoId: string;
  /** The post already written from this service, if there is one. */
  projectId: string | null;
  videoTitle: string;
  rawSegments: Segment[];
  editableSegments: Segment[];
  /** Uploaded documents whose text could be read. */
  documentCount: number;
}

// The first ids come from the segment seq so the server render and the client
// state agree; a random id here would not match after hydration, and the
// "Show where it says" jump would find no paragraph. Blocks made later by a
// split or insert get a random id.
export function toBlocks(segments: Segment[]): ParagraphBlock[] {
  return segments.map((s) => ({
    id: `seg-${s.seq}`,
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.text,
  }));
}

export function TranscriptReviewClient({
  workspaceId,
  workspaceSlug,
  videoId,
  projectId,
  videoTitle,
  rawSegments,
  editableSegments,
  documentCount,
}: TranscriptReviewClientProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<ParagraphBlock[]>(() =>
    toBlocks(editableSegments)
  );
  const historyRef = useRef<ParagraphBlock[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [endMs, setEndMs] = useState<number | null>(null);
  const [activeTimestamp, setActiveTimestamp] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [generateRunId, setGenerateRunId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Phones show one column at a time; wider screens show both side by side.
  const [mobilePane, setMobilePane] = useState<"edit" | "youtube">("edit");
  const checkStartedRef = useRef(false);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const originalPaneRef = useRef<HTMLDivElement>(null);
  const cleanedPaneRef = useRef<HTMLDivElement>(null);
  const focusBlockRef = useRef<string | null>(null);

  // Trimmed blocks based on start/end markers
  const visibleBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (startMs !== null && b.endMs < startMs) return false;
      if (endMs !== null && b.startMs > endMs) return false;
      return true;
    });
  }, [blocks, startMs, endMs]);

  // Visible raw segments based on trim
  const visibleRaw = useMemo(() => {
    return rawSegments.filter((s) => {
      if (startMs !== null && s.endMs < startMs) return false;
      if (endMs !== null && s.startMs > endMs) return false;
      return true;
    });
  }, [rawSegments, startMs, endMs]);

  const pushHistory = useCallback((snapshot: ParagraphBlock[]) => {
    historyRef.current.push(snapshot);
    setCanUndo(true);
  }, []);

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) setBlocks(prev);
    setCanUndo(historyRef.current.length > 0);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setBlocks((prev) => {
        pushHistory(prev);
        return prev.filter((b) => b.id !== id);
      });
    },
    [pushHistory]
  );

  const handleTextChange = useCallback((id: string, text: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, text } : b))
    );
  }, []);

  const handleInsertBelow = useCallback(
    (id: string) => {
      const newId = crypto.randomUUID();
      focusBlockRef.current = newId;
      setBlocks((prev) => {
        pushHistory(prev);
        const idx = prev.findIndex((b) => b.id === id);
        if (idx === -1) return prev;
        const current = prev[idx];
        const newBlock: ParagraphBlock = {
          id: newId,
          startMs: current.startMs,
          endMs: current.endMs,
          text: "",
        };
        const next = [...prev];
        next.splice(idx + 1, 0, newBlock);
        return next;
      });
    },
    [pushHistory]
  );

  const handleSplitBlock = useCallback(
    (id: string, cursorPos: number) => {
      const newId = crypto.randomUUID();
      focusBlockRef.current = newId;
      setBlocks((prev) => {
        pushHistory(prev);
        const idx = prev.findIndex((b) => b.id === id);
        if (idx === -1) return prev;
        const current = prev[idx];
        const before = current.text.slice(0, cursorPos).trimEnd();
        const after = current.text.slice(cursorPos).trimStart();
        const updated = { ...current, text: before };
        const newBlock: ParagraphBlock = {
          id: newId,
          startMs: current.startMs,
          endMs: current.endMs,
          text: after,
        };
        const next = [...prev];
        next.splice(idx, 1, updated, newBlock);
        return next;
      });
    },
    [pushHistory]
  );

  // Compare the words with the sermon and bulletin. It runs by itself when
  // the page opens, on the transcript as it stands, and only suggests.
  const getBlockParagraphs = useCallback(
    () => blocksRef.current.map((b) => ({ id: b.id, text: b.text })),
    []
  );
  const { spots, checkStatus, runCheck, setSpotState } = useWordCheck({
    workspaceId,
    videoId,
    getParagraphs: getBlockParagraphs,
    initialStatus: "checking",
  });

  useEffect(() => {
    if (projectId || documentCount === 0 || checkStartedRef.current) return;
    checkStartedRef.current = true;
    void runCheck();
  }, [projectId, documentCount, runCheck]);

  const focusBlock = useCallback((id: string) => {
    setMobilePane("edit");
    requestAnimationFrame(() => {
      const el = cleanedPaneRef.current?.querySelector<HTMLTextAreaElement>(
        `[data-block-id="${id}"] textarea`
      );
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    });
  }, []);

  const handleUseSpot = useCallback(
    (spot: Spot) => {
      const block = blocksRef.current.find((b) => b.id === spot.paragraphId);
      const next = block ? applySpot(block.text, spot.original, spot.suggestion) : null;
      if (!block || next === null) {
        // The words were already edited by hand; nothing left to swap.
        setSpotState(spot.key, "gone");
        return;
      }
      setBlocks((prev) => {
        pushHistory(prev);
        return prev.map((b) => (b.id === block.id ? { ...b, text: next } : b));
      });
      setSpotState(spot.key, "used");
    },
    [pushHistory, setSpotState]
  );

  const openSpotsByBlock = useMemo(() => {
    const map = new Map<string, Spot[]>();
    for (const s of spots) {
      if (s.state !== "open") continue;
      map.set(s.paragraphId, [...(map.get(s.paragraphId) ?? []), s]);
    }
    return map;
  }, [spots]);

  // Auto-focus newly created blocks
  useEffect(() => {
    if (!focusBlockRef.current) return;
    const id = focusBlockRef.current;
    focusBlockRef.current = null;
    requestAnimationFrame(() => {
      const container = cleanedPaneRef.current;
      if (!container) return;
      const el = container.querySelector<HTMLTextAreaElement>(
        `[data-block-id="${id}"] textarea`
      );
      if (el) {
        el.focus();
        el.setSelectionRange(0, 0);
      }
    });
  }, [blocks]);

  const handleBlockFocus = useCallback((timestampMs: number) => {
    setActiveTimestamp(timestampMs);
    const container = originalPaneRef.current;
    if (!container) return;
    const segmentEls = container.querySelectorAll<HTMLElement>("[data-ts]");
    let best: HTMLElement | null = null;
    let bestTs = -1;
    for (const el of segmentEls) {
      const ts = Number(el.dataset.ts);
      if (ts <= timestampMs && ts > bestTs) {
        bestTs = ts;
        best = el;
      }
    }
    if (best) {
      best.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleMarkStart = useCallback((ms: number) => {
    setStartMs(ms);
  }, []);

  const handleMarkEnd = useCallback((ms: number) => {
    setEndMs(ms);
  }, []);

  const handleClearTrim = useCallback(() => {
    setStartMs(null);
    setEndMs(null);
  }, []);

  // Save reviewed transcript and create the initial project
  async function handleSaveAndGenerate() {
    setSaving(true);
    setError("");
    try {
      // 1. Save the reviewed transcript as human_edited revision
      const segments = visibleBlocks.map((b, i) => ({
        seq: i,
        startMs: b.startMs,
        endMs: b.endMs,
        text: b.text,
      }));

      const saveRes = await fetch(
        `/api/workspaces/${workspaceId}/videos/${videoId}/reviewed-transcript`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments }),
        }
      );

      if (!saveRes.ok) {
        const data = await saveRes.json();
        setError(data.error || "We couldn't save your changes. Try again.");
        return;
      }

      // 2. Create the project from the reviewed transcript
      await startGenerate();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  // Kick off draft generation (the transcript must already be saved)
  async function startGenerate() {
    const genRes = await fetch(
      `/api/workspaces/${workspaceId}/videos/${videoId}/generate`,
      { method: "POST" }
    );

    if (!genRes.ok) {
      const data = await genRes.json();
      setError(data.error || "We couldn't start writing the post. Try again.");
      return;
    }

    const data = await genRes.json();
    setGenerateRunId(data.runId);
  }

  if (generateRunId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold">Writing your post...</h2>
          <p className="text-sm text-zinc-500">This usually takes about a minute.</p>
          <RunStatus
            runId={generateRunId}
            onSuccess={(run) => {
              const newProjectId = (run.outputJson as { projectId?: string })
                ?.projectId;
              router.push(
                newProjectId
                  ? `/w/${workspaceSlug}/projects/${newProjectId}`
                  : `/w/${workspaceSlug}/library`
              );
              router.refresh();
            }}
            onRetry={() => {
              setGenerateRunId(null);
              void startGenerate();
            }}
            onDismiss={() => setGenerateRunId(null)}
          />
        </div>
      </div>
    );
  }

  const primaryAction = projectId ? (
    <Link
      href={`/w/${workspaceSlug}/projects/${projectId}`}
      className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 md:min-h-0 md:w-auto md:rounded-md md:px-3 md:py-1.5 md:text-xs md:font-medium"
    >
      <span className="truncate">Go to the post</span>
    </Link>
  ) : (
    <button
      onClick={handleSaveAndGenerate}
      disabled={saving || visibleBlocks.length === 0}
      className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 md:min-h-0 md:w-auto md:rounded-md md:px-3 md:py-1.5 md:text-xs md:font-medium"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin md:h-3 md:w-3" aria-hidden="true" />
      ) : (
        <Sparkles className="h-4 w-4 md:h-3 md:w-3" aria-hidden="true" />
      )}
      <span className="truncate">Save and write the post</span>
    </button>
  );

  return (
    <div className="flex min-h-full flex-col md:h-full">
      <div className="border-b border-zinc-200 px-4 pt-4 pb-3 dark:border-zinc-800">
        <ServiceSteps
          workspaceSlug={workspaceSlug}
          videoId={videoId}
          projectId={projectId}
          canEdit
          current="words"
        />
      </div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={
              serviceStepHref(workspaceSlug, videoId, "documents", {
                projectId,
                canEdit: true,
              })!
            }
            aria-label="Back to documents"
            className="shrink-0 text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 pointer-coarse:-m-3.5 pointer-coarse:p-3.5 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold">Check the words</h1>
            <p className="truncate text-xs text-zinc-500">
              {videoTitle}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Trim indicators */}
          {(startMs !== null || endMs !== null) && (
            <div className="flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
              <Scissors className="h-3 w-3 text-zinc-500" />
              <span>
                {startMs !== null ? formatTimestampMs(startMs) : "start"}
                {" to "}
                {endMs !== null ? formatTimestampMs(endMs) : "end"}
              </span>
              <button
                onClick={handleClearTrim}
                aria-label="Clear start and end marks"
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 pointer-coarse:flex pointer-coarse:size-11 pointer-coarse:items-center pointer-coarse:justify-center"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}
          <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {visibleBlocks.length} blocks
          </span>
          <div className="hidden md:block">{primaryAction}</div>
        </div>
      </div>

      {error && (
        <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {!projectId && (
        <WordCheckPanel
          documentCount={documentCount}
          documentsHref={
            serviceStepHref(workspaceSlug, videoId, "documents", {
              projectId,
              canEdit: true,
            })!
          }
          status={checkStatus}
          spots={spots}
          paragraphStart={(id) => blocks.find((b) => b.id === id)?.startMs ?? null}
          onUse={handleUseSpot}
          onKeep={(spot) => setSpotState(spot.key, "kept")}
          onShow={(spot) => focusBlock(spot.paragraphId)}
          onRetry={() => void runCheck()}
        />
      )}

      {/* Video embed */}
      {videoId && (
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="mx-auto max-w-2xl aspect-video overflow-hidden rounded-lg">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title={`Video: ${videoTitle}`}
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Phones: switch between the two columns */}
      <div
        role="group"
        aria-label="Which words to show"
        className="flex gap-1 border-b border-zinc-200 p-2 md:hidden dark:border-zinc-800"
      >
        {(
          [
            ["edit", "Your version"],
            ["youtube", "From YouTube"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={mobilePane === key}
            onClick={() => setMobilePane(key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              mobilePane === key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Two-pane editor */}
      <div className="flex md:min-h-0 md:flex-1 md:overflow-hidden">
        {/* Left pane: raw segments */}
        <div
          className={`${mobilePane === "youtube" ? "flex" : "hidden"} w-full flex-col md:flex md:w-1/2 md:border-r md:border-zinc-200 md:dark:border-zinc-800`}
        >
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              From YouTube ({visibleRaw.length} lines)
            </h3>
          </div>
          <div
            ref={originalPaneRef}
            className="space-y-1 p-2 font-mono text-xs md:flex-1 md:overflow-y-auto"
          >
            {visibleRaw.map((seg) => {
              const isActive =
                activeTimestamp !== null &&
                seg.startMs <= activeTimestamp &&
                seg.endMs >= activeTimestamp;
              return (
                <div
                  key={seg.seq}
                  data-ts={seg.startMs}
                  className={`rounded px-1.5 py-0.5 transition-colors ${
                    isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  <span className="text-zinc-500 dark:text-zinc-400">
                    [{formatTimestampMs(seg.startMs)}]
                  </span>{" "}
                  {seg.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right pane: editable blocks */}
        <div
          className={`${mobilePane === "edit" ? "flex" : "hidden"} w-full flex-col md:flex md:w-1/2`}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Your version ({visibleBlocks.length} paragraphs)
            </h3>
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
            >
              <Undo2 className="h-3 w-3" aria-hidden="true" />
              <span className="truncate">Undo</span>
            </button>
          </div>
          <div
            ref={cleanedPaneRef}
            className="space-y-2 p-2 md:flex-1 md:overflow-y-auto"
          >
            {visibleBlocks.map((block) => {
              const flags = flagContent(block.text);
              const hasFlaggedContent = flags.length > 0;
              // Whisper-transcribed videos have no [music] markers for the
              // pipeline to strip hymns by, so repetitive passages are
              // surfaced here for a human to remove rather than guessed at.
              const likelySung = looksSung(block.text);
              const blockSpots = openSpotsByBlock.get(block.id) ?? [];
              return (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  className="flex gap-1.5 pointer-coarse:flex-col"
                >
                  <BlockControls
                    startMs={block.startMs}
                    onDelete={() => handleDelete(block.id)}
                    onMarkStart={() => handleMarkStart(block.startMs)}
                    onMarkEnd={() => handleMarkEnd(block.endMs)}
                    onInsertBelow={() => handleInsertBelow(block.id)}
                  />

                  {/* Text area */}
                  <div className="flex-1 min-w-0">
                    {(hasFlaggedContent || likelySung || blockSpots.length > 0) && (
                      <div className="mb-0.5 flex flex-wrap items-center gap-x-2">
                        {hasFlaggedContent && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            ⚠ {flags.map((f) => `"${f}"`).join(", ")}
                          </span>
                        )}
                        {blockSpots.length > 0 && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400">
                            Check: {blockSpots.map((s) => `"${s.original}"`).join(", ")}
                          </span>
                        )}
                        {likelySung && (
                          <span
                            className="text-[10px] text-indigo-600 dark:text-indigo-400"
                            title="Repeated words, often a hymn. Delete this paragraph if it is sung."
                          >
                            ♪ likely sung
                          </span>
                        )}
                      </div>
                    )}
                    <textarea
                      value={block.text}
                      onChange={(e) =>
                        handleTextChange(block.id, e.target.value)
                      }
                      onFocus={() => handleBlockFocus(block.startMs)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          const target = e.target as HTMLTextAreaElement;
                          handleSplitBlock(block.id, target.selectionStart);
                        }
                      }}
                      aria-label={`Paragraph at ${formatTimestampMs(block.startMs)}`}
                      className={`w-full rounded-md border px-2 py-1 text-xs resize-y min-h-[48px] focus:outline-none focus:ring-1 focus:ring-blue-500 pointer-coarse:[field-sizing:content] md:font-mono ${
                        hasFlaggedContent
                          ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
                          : likelySung
                            ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/20"
                            : "border-zinc-200 dark:border-zinc-700"
                      }`}
                      rows={Math.max(2, Math.ceil(block.text.length / 80))}
                    />
                  </div>
                </div>
              );
            })}
            {visibleBlocks.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-8">
                No blocks to display
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Phones: the next step stays in reach */}
      <div className="sticky bottom-0 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        {primaryAction}
      </div>
    </div>
  );
}
