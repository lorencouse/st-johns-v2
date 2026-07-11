"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpToLine,
  ArrowDownToLine,
  X,
  Plus,
  Undo2,
  Scissors,
  Sparkles,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { formatTimestampMs } from "@/lib/format";
import { flagContent } from "@/lib/content-flags";
import { RunStatus } from "@/components/studio/run-status";

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
  videoTitle: string;
  providerVideoId: string;
  rawSegments: Segment[];
  editableSegments: Segment[];
}

function toBlocks(segments: Segment[]): ParagraphBlock[] {
  return segments.map((s) => ({
    id: crypto.randomUUID(),
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.text,
  }));
}

export function TranscriptReviewClient({
  workspaceId,
  workspaceSlug,
  videoId,
  videoTitle,
  providerVideoId,
  rawSegments,
  editableSegments,
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
        setError(data.error || "Failed to save transcript");
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
      setError(data.error || "Failed to start generation");
      return;
    }

    const data = await genRes.json();
    setGenerateRunId(data.runId);
  }

  if (generateRunId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold">Generating your draft...</h2>
          <RunStatus
            runId={generateRunId}
            onSuccess={(run) => {
              const projectId = (run.outputJson as { projectId?: string })
                ?.projectId;
              router.push(
                projectId
                  ? `/w/${workspaceSlug}/projects/${projectId}`
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href={`/w/${workspaceSlug}/library`}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold">Review Transcript</h1>
            <p className="text-xs text-zinc-500">
              {videoTitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Trim indicators */}
          {(startMs !== null || endMs !== null) && (
            <div className="flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
              <Scissors className="h-3 w-3 text-zinc-500" />
              <span>
                {startMs !== null ? formatTimestampMs(startMs) : "start"}
                {" — "}
                {endMs !== null ? formatTimestampMs(endMs) : "end"}
              </span>
              <button
                onClick={handleClearTrim}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <span className="text-xs text-zinc-400">
            {visibleBlocks.length} blocks
          </span>
          <button
            onClick={handleSaveAndGenerate}
            disabled={saving || visibleBlocks.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Save Transcript & Start Project
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30">
          {error}
        </div>
      )}

      {/* Video embed */}
      {providerVideoId && (
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="mx-auto max-w-2xl aspect-video overflow-hidden rounded-lg">
            <iframe
              src={`https://www.youtube.com/embed/${providerVideoId}`}
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Two-pane editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane: raw segments */}
        <div className="w-1/2 flex flex-col border-r border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase text-zinc-400">
              Original (raw captions) — {visibleRaw.length} segments
            </h3>
          </div>
          <div
            ref={originalPaneRef}
            className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs"
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
                  <span className="text-zinc-400">
                    [{formatTimestampMs(seg.startMs)}]
                  </span>{" "}
                  {seg.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right pane: editable blocks */}
        <div className="w-1/2 flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase text-zinc-400">
              Cleaned (editable) — {visibleBlocks.length} blocks
            </h3>
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </button>
          </div>
          <div
            ref={cleanedPaneRef}
            className="flex-1 overflow-y-auto p-2 space-y-2"
          >
            {visibleBlocks.map((block) => {
              const flags = flagContent(block.text);
              const hasFlaggedContent = flags.length > 0;
              return (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  className="flex gap-1.5"
                >
                  {/* Controls column */}
                  <div className="flex flex-col items-center justify-between pt-0.5 pb-0.5 shrink-0 w-7">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-mono text-zinc-400 whitespace-nowrap">
                        {formatTimestampMs(block.startMs)}
                      </span>
                      <button
                        onClick={() => handleDelete(block.id)}
                        className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                        title="Delete block"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => handleMarkStart(block.startMs)}
                        className="rounded p-0.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-500 dark:hover:bg-emerald-950/30"
                        title="Mark as start"
                      >
                        <ArrowUpToLine className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleMarkEnd(block.endMs)}
                        className="rounded p-0.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                        title="Mark as end"
                      >
                        <ArrowDownToLine className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleInsertBelow(block.id)}
                      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                      title="Add block below"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Text area */}
                  <div className="flex-1 min-w-0">
                    {hasFlaggedContent && (
                      <div className="mb-0.5">
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          ⚠ {flags.map((f) => `"${f}"`).join(", ")}
                        </span>
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
                      className={`w-full rounded-md border px-2 py-1 font-mono text-xs resize-y min-h-[48px] focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        hasFlaggedContent
                          ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
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
    </div>
  );
}
