"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RunStatus } from "@/components/studio/run-status";

interface VideoActionsProps {
  workspaceId: string;
  videoId: string;
  workspaceSlug: string;
  ingestStatus: string;
  /** Premiere or stream that has not finished airing — nothing to fetch yet. */
  isScheduled?: boolean;
  project: { id: string; status: string } | null;
}

export function VideoActions({
  workspaceId,
  videoId,
  workspaceSlug,
  ingestStatus,
  isScheduled = false,
  project,
}: VideoActionsProps) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleIngest() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/videos/${videoId}/ingest`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start ingestion");
        return;
      }
      const data = await res.json();
      setRunId(data.runId);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (runId) {
    return (
      <RunStatus
        runId={runId}
        onSuccess={() => {
          router.refresh();
          setRunId(null);
        }}
        onRetry={() => {
          setRunId(null);
          handleIngest();
        }}
        onDismiss={() => {
          setRunId(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {project && (
        <Link
          href={`/w/${workspaceSlug}/projects/${project.id}`}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Open project
        </Link>
      )}

      {ingestStatus !== "captions_available" && !isScheduled && (
        <button
          onClick={handleIngest}
          disabled={loading}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "..." : "Fetch captions"}
        </button>
      )}

      {ingestStatus === "captions_available" && !project && (
        <Link
          href={`/w/${workspaceSlug}/library/${videoId}/review`}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Review transcript
        </Link>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
