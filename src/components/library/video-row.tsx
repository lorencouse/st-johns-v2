"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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
    liveStatus: string | null;
    scheduledStartAt: string | null;
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

  // A premiere or stream that has not finished airing: no audio exists yet, so
  // there is nothing to fetch or review until it does.
  const isUpcoming = video.liveStatus === "upcoming";
  const isLive = video.liveStatus === "live";
  const isScheduled = isUpcoming || isLive;

  function handleClick() {
    if (isScheduled) return;
    if (project) {
      router.push(`/w/${workspaceSlug}/projects/${project.id}`);
      return;
    }

    if (video.ingestStatus === "captions_available") {
      router.push(`/w/${workspaceSlug}/library/${video.id}/review`);
      return;
    }
  }

  const pipelineLabel = isLive
    ? "Live now"
    : isUpcoming
      ? "Scheduled"
      : video.ingestStatus === "captions_available"
        ? "Transcript ready"
        : video.ingestStatus === "ingest_failed"
          ? "Ingest failed"
          : video.ingestStatus === "metadata_synced"
            ? "Waiting for captions"
            : "Not processed";

  const pipelineTone = isLive
    ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : isUpcoming
      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      : video.ingestStatus === "captions_available"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
        : video.ingestStatus === "ingest_failed"
          ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";

  const scheduledFor = video.scheduledStartAt
    ? new Date(video.scheduledStartAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

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
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-9 w-16 shrink-0 rounded object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <span className="font-medium line-clamp-1">{video.title}</span>
            <p className="mt-1 text-xs text-zinc-500">
              {isLive
                ? "Airing now — captions can be fetched once it ends"
                : isUpcoming
                  ? scheduledFor
                    ? `Premieres ${scheduledFor} — nothing to transcribe yet`
                    : "Not aired yet — nothing to transcribe yet"
                  : project
                    ? "Open the project workspace"
                    : video.ingestStatus === "captions_available"
                      ? "Review transcript and start a project"
                      : "Imported to the library and ready for captions when you choose"}
            </p>
          </div>
        </button>
      </td>
      <td className="px-4 py-4 pr-4 text-zinc-500">{channelTitle}</td>
      <td className="px-4 py-4 pr-4 text-zinc-500">
        {isUpcoming && scheduledFor
          ? scheduledFor
          : video.publishedAt
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
          isScheduled={isScheduled}
          project={project}
        />
      </td>
    </tr>
  );
}
