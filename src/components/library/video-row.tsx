"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RunStatus } from "@/components/studio/run-status";

interface VideoRowProps {
  workspaceId: string;
  workspaceSlug: string;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    publishedAt: Date | null;
  };
  channelTitle: string | null;
  ingestStatus: string;
  project: { id: string; status: string } | null;
}

export function VideoRow({
  workspaceId,
  workspaceSlug,
  video,
  channelTitle,
  ingestStatus,
  project,
}: VideoRowProps) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    // If project exists, navigate to it
    if (project) {
      router.push(`/w/${workspaceSlug}/projects/${project.id}`);
      return;
    }

    // If captions are available, go to review
    if (ingestStatus === "captions_available") {
      router.push(`/w/${workspaceSlug}/library/${video.id}/review`);
      return;
    }

    // Otherwise, trigger ingest
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/videos/${video.id}/ingest`,
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

  function handleIngestComplete() {
    setRunId(null);
    // After ingest completes, go to review
    router.push(`/w/${workspaceSlug}/library/${video.id}/review`);
  }

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-3 pr-4">
        <button
          onClick={handleClick}
          disabled={loading || !!runId}
          className="flex items-center gap-3 text-left hover:opacity-80 disabled:opacity-60"
        >
          {video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-9 w-16 shrink-0 rounded object-cover"
            />
          )}
          <span className="font-medium line-clamp-1">{video.title}</span>
        </button>
      </td>
      <td className="py-3 pr-4 text-zinc-500">{channelTitle}</td>
      <td className="py-3 pr-4 text-zinc-500">
        {video.publishedAt
          ? new Date(video.publishedAt).toLocaleDateString()
          : "—"}
      </td>
      <td className="py-3 pr-4">
        {runId ? (
          <RunStatus runId={runId} onComplete={handleIngestComplete} />
        ) : loading ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            starting...
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
            {ingestStatus.replace("_", " ")}
          </span>
        )}
      </td>
      <td className="py-3 pr-4">
        {project ? (
          <Link
            href={`/w/${workspaceSlug}/projects/${project.id}`}
            className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
          >
            {project.status.replace("_", " ")}
          </Link>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        )}
      </td>
      <td className="py-3">
        {error && <span className="text-xs text-red-500">{error}</span>}
      </td>
    </tr>
  );
}
