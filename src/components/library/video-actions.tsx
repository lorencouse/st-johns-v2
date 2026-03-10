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
  hasProject: boolean;
}

export function VideoActions({
  workspaceId,
  videoId,
  workspaceSlug,
  ingestStatus,
  hasProject,
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
        onComplete={() => {
          router.refresh();
          setRunId(null);
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {ingestStatus !== "captions_available" && (
        <button
          onClick={handleIngest}
          disabled={loading}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "..." : "Fetch captions"}
        </button>
      )}

      {ingestStatus === "captions_available" && !hasProject && (
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
