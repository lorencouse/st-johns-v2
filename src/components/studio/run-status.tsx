"use client";

import { useEffect, useState } from "react";

interface RunStatusProps {
  runId: string;
  onComplete?: () => void;
}

interface RunData {
  id: string;
  status: string;
  kind: string;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export function RunStatus({ runId, onComplete }: RunStatusProps) {
  const [run, setRun] = useState<RunData | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setRun(data);

        if (data.status === "succeeded" || data.status === "failed") {
          onComplete?.();
          return;
        }

        // Continue polling
        setTimeout(poll, 2000);
      } catch {
        if (active) setTimeout(poll, 5000);
      }
    }

    poll();
    return () => {
      active = false;
    };
  }, [runId, onComplete]);

  if (!run) return null;

  const statusColor =
    run.status === "succeeded"
      ? "text-green-600"
      : run.status === "failed"
        ? "text-red-600"
        : run.status === "running"
          ? "text-blue-600"
          : "text-zinc-500";

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{run.kind}</span>
        <span className={`text-xs font-semibold ${statusColor}`}>
          {run.status === "running" && (
            <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          )}
          {run.status}
        </span>
      </div>
      {run.errorMessage && (
        <p className="mt-1 text-xs text-red-500">{run.errorMessage}</p>
      )}
    </div>
  );
}
