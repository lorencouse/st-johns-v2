import { MonitorPlay } from "lucide-react";
import { VideoActions } from "./video-actions";
import { postStatusLabel, postStatusTone } from "@/lib/status-labels";

export interface LatestService {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  ingestStatus: string;
  captionsReady: boolean;
  project: { id: string; status: string } | null;
}

interface LatestServiceCardProps {
  workspaceSlug: string;
  video: LatestService;
  canEdit: boolean;
}

/** One sentence telling staff where this service is up to. */
function nextStepText(video: LatestService): string {
  const status = video.project?.status;
  if (status === "ready_for_review") return "The post is waiting for approval.";
  if (status === "changes_requested")
    return "Changes were requested on the post. Open it to see them.";
  if (status === "published") return "This post is on your website.";
  if (status === "approved") return "The post is approved and ready to publish.";
  if (status) return "The post is in progress. Pick up where you left off.";
  if (video.captionsReady)
    return "The captions are ready. Turn this service into a blog post.";
  if (video.ingestStatus === "ingest_failed")
    return "We couldn't get the captions last time. Open it to try again.";
  return "Get the captions from YouTube to start the post.";
}

export function LatestServiceCard({
  workspaceSlug,
  video,
  canEdit,
}: LatestServiceCardProps) {
  const date = video.publishedAt
    ? new Date(video.publishedAt).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <section
      aria-labelledby="latest-service-heading"
      className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="aspect-video w-full max-w-full shrink-0 overflow-hidden rounded-xl bg-zinc-100 md:w-64 dark:bg-zinc-900">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500 dark:text-zinc-400">
              <MonitorPlay className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Latest service
          </p>
          <h2
            id="latest-service-heading"
            className="mt-2 text-2xl font-semibold tracking-tight text-balance"
          >
            {video.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            {date && <span>{date}</span>}
            {video.project && (
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${postStatusTone(video.project.status)}`}
              >
                {postStatusLabel(video.project.status)}
              </span>
            )}
          </div>
          <p className="mt-3 max-w-xl text-pretty text-zinc-600 dark:text-zinc-300">
            {nextStepText(video)}
          </p>
          <div className="mt-4">
            <VideoActions
              videoId={video.id}
              workspaceSlug={workspaceSlug}
              captionsReady={video.captionsReady}
              project={video.project}
              canEdit={canEdit}
              size="large"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
