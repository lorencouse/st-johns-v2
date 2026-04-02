"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { VideoActions } from "./video-actions";

interface VideoRowProps {
  workspaceId: string;
  workspaceSlug: string;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    publishedAt: Date | null;
    ingestStatus: string;
  };
  channelTitle: string | null;
  project: { id: string; status: string } | null;
}

export function VideoRow({
  workspaceId,
  workspaceSlug,
  video,
  channelTitle,
  project,
}: VideoRowProps) {
  const router = useRouter();

  function handleClick() {
    if (project) {
      router.push(`/w/${workspaceSlug}/projects/${project.id}`);
      return;
    }

    if (video.ingestStatus === "captions_available") {
      router.push(`/w/${workspaceSlug}/library/${video.id}/review`);
      return;
    }
  }

  const pipelineLabel =
    video.ingestStatus === "captions_available"
      ? "Transcript ready"
      : video.ingestStatus === "ingest_failed"
        ? "Ingest failed"
        : video.ingestStatus === "metadata_synced"
          ? "Waiting for captions"
          : "Not processed";

  const pipelineTone =
    video.ingestStatus === "captions_available"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : video.ingestStatus === "ingest_failed"
        ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";

  const projectTone = project
    ? project.status === "approved"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : project.status === "ready_for_review"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        : project.status === "changes_requested"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
    : "";

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="px-4 py-4 pr-4">
        <button
          onClick={handleClick}
          className="flex items-center gap-3 text-left hover:opacity-80"
        >
          {video.thumbnailUrl && (
            <Image
              src={video.thumbnailUrl}
              alt=""
              width={64}
              height={36}
              className="h-9 w-16 shrink-0 rounded object-cover"
            />
          )}
          <div>
            <span className="font-medium line-clamp-1">{video.title}</span>
            <p className="mt-1 text-xs text-zinc-500">
              {project
                ? "Open the project workspace"
                : video.ingestStatus === "captions_available"
                  ? "Review transcript and start drafting"
                  : "Fetch captions to start the editorial flow"}
            </p>
          </div>
        </button>
      </td>
      <td className="px-4 py-4 pr-4 text-zinc-500">{channelTitle}</td>
      <td className="px-4 py-4 pr-4 text-zinc-500">
        {video.publishedAt
          ? new Date(video.publishedAt).toLocaleDateString()
          : "—"}
      </td>
      <td className="px-4 py-4 pr-4">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${pipelineTone}`}>
          {pipelineLabel}
        </span>
      </td>
      <td className="px-4 py-4 pr-4">
        {project ? (
          <Link
            href={`/w/${workspaceSlug}/projects/${project.id}`}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${projectTone}`}
          >
            {project.status.replace("_", " ")}
          </Link>
        ) : (
          <span className="text-xs text-zinc-400">Not started</span>
        )}
      </td>
      <td className="px-4 py-4">
        <VideoActions
          workspaceId={workspaceId}
          videoId={video.id}
          workspaceSlug={workspaceSlug}
          ingestStatus={video.ingestStatus}
          project={project}
        />
      </td>
    </tr>
  );
}
