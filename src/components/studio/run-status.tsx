"use client";

import { useEffect, useState } from "react";

interface RunStatusProps {
  runId: string;
  /** Called once when the run succeeds. Failures keep the error visible instead. */
  onSuccess?: (run: RunData) => void;
  /** When provided, a failed run shows a Retry button that calls this. */
  onRetry?: () => void;
  /** When provided, a failed run shows a Dismiss button that calls this. */
  onDismiss?: () => void;
}

export interface RunData {
  id: string;
  status: string;
  kind: string;
  errorMessage?: string | null;
  outputJson?: Record<string, unknown> | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

const KIND_LABELS: Record<string, string> = {
  channel_sync: "Channel import",
  video_ingest: "Caption fetch",
  project_generate: "Draft generation",
  export_render: "Export",
};

export function RunStatus({
  runId,
  onSuccess,
  onRetry,
  onDismiss,
}: RunStatusProps) {
  const [run, setRun] = useState<RunData | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) {
          if (active) setTimeout(poll, 5000);
          return;
        }
        const data = (await res.json()) as RunData;
        if (!active) return;
        setRun(data);

        if (data.status === "succeeded") {
          onSuccess?.(data);
          return;
        }
        if (data.status === "failed" || data.status === "cancelled") {
          // Stay mounted so the user sees the error and can retry.
          return;
        }

        setTimeout(poll, 2000);
      } catch {
        if (active) setTimeout(poll, 5000);
      }
    }

    poll();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  if (!run) return null;

  const failed = run.status === "failed" || run.status === "cancelled";
  const statusColor =
    run.status === "succeeded"
      ? "text-green-600"
      : failed
        ? "text-red-600"
        : run.status === "running"
          ? "text-blue-600"
          : "text-zinc-500";

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">
          {KIND_LABELS[run.kind] ?? run.kind}
        </span>
        <span className={`text-xs font-semibold ${statusColor}`}>
          {run.status === "running" && (
            <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          )}
          {run.status}
        </span>
      </div>
      {failed && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-red-500">
            {run.errorMessage || "The job failed. Please try again."}
          </p>
          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
