"use client";

import Link from "next/link";
import { ArrowRight, Check, FileSearch, Loader2, RotateCw } from "lucide-react";
import { formatTimestampMs } from "@/lib/format";

type SpotState = "open" | "used" | "kept" | "gone";

export interface Spot {
  key: string;
  paragraphId: string;
  original: string;
  suggestion: string;
  reason: string;
  state: SpotState;
}

/** "idle" means not run yet: the post editor runs the check only when asked. */
export type WordCheckStatus = "idle" | "checking" | "done" | "error";

interface WordCheckPanelProps {
  documentCount: number;
  documentsHref: string;
  status: WordCheckStatus;
  spots: Spot[];
  /** Start time of each paragraph, to show where a spot is. */
  paragraphStart: (paragraphId: string) => number | null;
  onUse: (spot: Spot) => void;
  onKeep: (spot: Spot) => void;
  onShow: (spot: Spot) => void;
  /** Runs the check: the start button when idle, and Try again after an error. */
  onRetry: () => void;
  /** Shown once every spot is dealt with. */
  allDoneMessage?: string;
  /** What the check compares, for the idle prompt. */
  subject?: string;
  /** Wrapper styling, so the panel can sit in a page edge or inside a column. */
  className?: string;
}

/**
 * The places where the transcript and the sermon or bulletin disagree, each
 * with the documents' spelling. Nothing changes until the person picks
 * "Use this".
 */
export function WordCheckPanel({
  documentCount,
  documentsHref,
  status,
  spots,
  paragraphStart,
  onUse,
  onKeep,
  onShow,
  onRetry,
  allDoneMessage = "All checked. You can write the post now.",
  subject = "the words",
  className = "border-b border-zinc-200 bg-blue-50/40 px-4 py-3 dark:border-zinc-800 dark:bg-blue-950/10",
}: WordCheckPanelProps) {
  if (documentCount === 0) {
    return (
      <div className={`${className} text-sm text-zinc-600 dark:text-zinc-300`}>
        <span className="text-pretty">
          Add the sermon or bulletin and we&apos;ll check names, Bible verses
          and hymn titles for you.{" "}
        </span>
        <Link href={documentsHref} className="inline-flex min-h-11 items-center font-medium text-blue-600 hover:underline sm:min-h-0">
          Add documents
        </Link>
      </div>
    );
  }

  const open = spots.filter((s) => s.state === "open");
  const done = spots.length - open.length;

  return (
    <section aria-labelledby="spots-heading" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="spots-heading" className="flex items-center gap-2 text-sm font-semibold">
          <FileSearch className="h-4 w-4 text-blue-600" aria-hidden="true" />
          Spots to check
          {status === "done" && spots.length > 0 && (
            <span className="tabular-nums font-normal text-zinc-500">
              {open.length} left{done > 0 ? `, ${done} done` : ""}
            </span>
          )}
        </h2>
        {status === "error" && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-white sm:min-h-9 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        )}
      </div>

      <div aria-live="polite" className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        {status === "idle" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-pretty">
              Compare {subject} with your{" "}
              {documentCount === 1 ? "document" : `${documentCount} documents`} to
              catch misspelled names, Bible verses and hymn titles.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 sm:min-h-9"
            >
              <FileSearch className="h-4 w-4" aria-hidden="true" />
              Check against the documents
            </button>
          </div>
        )}
        {status === "checking" && (
          <p className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
            Comparing {subject} with your{" "}
            {documentCount === 1 ? "document" : `${documentCount} documents`}...
          </p>
        )}
        {status === "error" && (
          <p>We couldn&apos;t compare the words with your documents.</p>
        )}
        {status === "done" && spots.length === 0 && (
          <p className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Names, verses and titles match your documents. Nothing to fix.
          </p>
        )}
        {status === "done" && spots.length > 0 && open.length === 0 && (
          <p className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {allDoneMessage}
          </p>
        )}
      </div>

      {open.length > 0 && (
        <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
          {open.map((spot) => {
            const at = paragraphStart(spot.paragraphId);
            return (
              <li
                key={spot.key}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-950"
              >
                <button
                  type="button"
                  onClick={() => onShow(spot)}
                  className="min-w-0 flex-1 text-left"
                  aria-label={`Show where it says ${spot.original}`}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 line-through decoration-amber-600/60 dark:bg-amber-900/40">
                      {spot.original}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium dark:bg-emerald-900/40">
                      {spot.suggestion}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-pretty text-zinc-500">
                    {at !== null && <span className="tabular-nums">{formatTimestampMs(at)} · </span>}
                    {spot.reason}
                  </span>
                </button>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onUse(spot)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 sm:min-h-9 sm:flex-none"
                  >
                    Use this
                  </button>
                  <button
                    type="button"
                    onClick={() => onKeep(spot)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 sm:min-h-9 sm:flex-none dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Keep as is
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
