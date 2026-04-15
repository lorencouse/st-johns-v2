"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { RunStatus } from "@/components/studio/run-status";
import { VideoRow } from "./video-row";

type FilterKey =
  | "all"
  | "needs_captions"
  | "ready_to_draft"
  | "drafting"
  | "review_queue"
  | "approved"
  | "no_project";

interface LibraryVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  ingestStatus: string;
  channelTitle: string | null;
  project: { id: string; status: string } | null;
}

interface LibraryDashboardProps {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  channelCount: number;
  syncRunId: string | null;
  videos: LibraryVideo[];
}

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All videos",
  needs_captions: "Needs captions",
  ready_to_draft: "Ready to draft",
  drafting: "Drafting",
  review_queue: "Review queue",
  approved: "Approved",
  no_project: "No project",
};

function hasProjectStatus(video: LibraryVideo, statuses: string[]) {
  return !!video.project && statuses.includes(video.project.status);
}

function matchesFilter(video: LibraryVideo, filter: FilterKey) {
  switch (filter) {
    case "all":
      return true;
    case "needs_captions":
      return video.ingestStatus !== "captions_available";
    case "ready_to_draft":
      return video.ingestStatus === "captions_available" && !video.project;
    case "drafting":
      return hasProjectStatus(video, ["drafting"]);
    case "review_queue":
      return hasProjectStatus(video, ["ready_for_review", "changes_requested"]);
    case "approved":
      return hasProjectStatus(video, ["approved"]);
    case "no_project":
      return !video.project;
  }
}

function getSummary(videos: LibraryVideo[], channelCount: number) {
  const captionsReady = videos.filter(
    (video) => video.ingestStatus === "captions_available"
  ).length;
  const readyToDraft = videos.filter((video) =>
    matchesFilter(video, "ready_to_draft")
  ).length;
  const drafting = videos.filter((video) => matchesFilter(video, "drafting")).length;
  const reviewQueue = videos.filter((video) =>
    matchesFilter(video, "review_queue")
  ).length;
  const approved = videos.filter((video) => matchesFilter(video, "approved")).length;
  const hasProject = videos.some((video) => !!video.project);
  const hasReviewActivity = videos.some((video) =>
    hasProjectStatus(video, ["ready_for_review", "changes_requested", "approved"])
  );

  const checklist = [
    {
      id: "connect_channel",
      title: "Connect a YouTube channel",
      description: "Grant YouTube access so the workspace can sync your library.",
      done: channelCount > 0,
      actionLabel: "Open integrations",
      href: "settings/integrations",
    },
    {
      id: "sync_videos",
      title: "Import your first videos",
      description: "Run a channel sync to populate the library with recent uploads.",
      done: videos.length > 0,
      actionLabel: "Open integrations",
      href: "settings/integrations",
    },
    {
      id: "fetch_captions",
      title: "Fetch a transcript",
      description: "Pull captions for at least one video so drafting can begin.",
      done: captionsReady > 0,
      actionLabel: "Show videos needing captions",
      filter: "needs_captions" as const,
    },
    {
      id: "generate_draft",
      title: "Generate your first draft",
      description: "Move a transcript into the editorial workflow.",
      done: hasProject,
      actionLabel: "Show draft-ready videos",
      filter: "ready_to_draft" as const,
    },
    {
      id: "start_review",
      title: "Send one item to review",
      description: "Use review to turn drafting into a repeatable publishing process.",
      done: hasReviewActivity,
      actionLabel: "Open review queue",
      href: "review",
    },
  ];

  return {
    captionsReady,
    readyToDraft,
    drafting,
    reviewQueue,
    approved,
    checklist,
    completedChecklistCount: checklist.filter((item) => item.done).length,
  };
}

export function LibraryDashboard({
  workspaceId,
  workspaceSlug,
  workspaceName,
  channelCount,
  syncRunId,
  videos,
}: LibraryDashboardProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [pendingRunId, setPendingRunId] = useState(syncRunId);
  const deferredQuery = useDeferredValue(query);

  const summary = useMemo(
    () => getSummary(videos, channelCount),
    [videos, channelCount]
  );

  const filteredVideos = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return videos.filter((video) => {
      if (!matchesFilter(video, activeFilter)) return false;
      if (!normalizedQuery) return true;

      return (
        video.title.toLowerCase().includes(normalizedQuery) ||
        (video.channelTitle ?? "").toLowerCase().includes(normalizedQuery) ||
        (video.project?.status ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [videos, activeFilter, deferredQuery]);

  const hasVideos = videos.length > 0;
  const completionPercent = Math.round(
    (summary.completedChecklistCount / summary.checklist.length) * 100
  );

  return (
    <div className="p-6">
      {pendingRunId && (
        <section className="mb-6 rounded-[24px] border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Importing channel videos
              </p>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-200">
                The channel link succeeded. This page will refresh as soon as the
                initial video sync finishes.
              </p>
            </div>
            <div className="min-w-[220px]">
              <RunStatus
                runId={pendingRunId}
                onComplete={() => {
                  setPendingRunId(null);
                  router.replace(`/w/${workspaceSlug}/library`);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.14),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(244,244,245,0.96))] p-6 shadow-sm dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.15),_transparent_30%),linear-gradient(135deg,_rgba(9,9,11,0.98),_rgba(24,24,27,0.96))]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">
              Workspace dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {workspaceName} content pipeline
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Track what has been synced, what is ready for drafting, and what
              still needs attention before it reaches review.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Videos in library"
              value={videos.length}
              detail={`${channelCount} synced channel${channelCount === 1 ? "" : "s"}`}
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
            <SummaryCard
              label="Ready to draft"
              value={summary.readyToDraft}
              detail="Captions available, no project yet"
              active={activeFilter === "ready_to_draft"}
              onClick={() => setActiveFilter("ready_to_draft")}
            />
            <SummaryCard
              label="In review"
              value={summary.reviewQueue}
              detail="Ready for review or changes requested"
              active={activeFilter === "review_queue"}
              onClick={() => setActiveFilter("review_queue")}
            />
            <SummaryCard
              label="Approved"
              value={summary.approved}
              detail="Completed editorial flow"
              active={activeFilter === "approved"}
              onClick={() => setActiveFilter("approved")}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Workflow views</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Filter the library by the next operational step instead of
                scanning every row.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <label htmlFor="library-search" className="sr-only">
                Search library
              </label>
              <input
                id="library-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, channels, or statuses"
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                "all",
                "needs_captions",
                "ready_to_draft",
                "drafting",
                "review_queue",
                "approved",
                "no_project",
              ] as FilterKey[]
            ).map((filter) => {
              const count = videos.filter((video) => matchesFilter(video, filter)).length;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    activeFilter === filter
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
                  }`}
                >
                  {FILTER_LABELS[filter]} ({count})
                </button>
              );
            })}
          </div>

          {!hasVideos ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <h3 className="text-lg font-semibold">Your library is empty</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Connect YouTube, sync the channel, and your newest videos will
                appear here for transcript processing and drafting.
              </p>
              <div className="mt-5">
                <a
                  href={`/api/auth/youtube-connect?redirect=${encodeURIComponent(`/w/${workspaceSlug}/library`)}&workspaceId=${encodeURIComponent(workspaceId)}`}
                  className="inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Connect YouTube
                </a>
              </div>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <h3 className="text-lg font-semibold">No videos match this view</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Try clearing the search or switching to a broader workflow
                filter.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Clear search
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Show all videos
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3 font-medium">Video</th>
                    <th className="px-4 py-3 font-medium">Channel</th>
                    <th className="px-4 py-3 font-medium">Published</th>
                    <th className="px-4 py-3 font-medium">Pipeline</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVideos.map((video) => (
                    <VideoRow
                      key={video.id}
                      workspaceId={workspaceId}
                      workspaceSlug={workspaceSlug}
                      video={{
                        id: video.id,
                        title: video.title,
                        thumbnailUrl: video.thumbnailUrl,
                        publishedAt: video.publishedAt
                          ? new Date(video.publishedAt)
                          : null,
                        ingestStatus: video.ingestStatus,
                      }}
                      channelTitle={video.channelTitle}
                      project={video.project}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Setup checklist</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Make the first publishing run obvious for new workspaces.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{completionPercent}%</p>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                completed
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width]"
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          <div className="mt-5 space-y-3">
            {summary.checklist.map((item, index) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 ${
                  item.done
                    ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      item.done
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {item.done ? "✓" : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {item.description}
                    </p>
                    {!item.done && item.href && (
                      <Link
                        href={`/w/${workspaceSlug}/${item.href}`}
                        className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {item.actionLabel}
                      </Link>
                    )}
                    {!item.done && item.filter && (
                      <button
                        type="button"
                        onClick={() => setActiveFilter(item.filter)}
                        className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-zinc-950 p-4 text-zinc-100 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Editorial signal
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <SignalStat label="Captions ready" value={summary.captionsReady} />
              <SignalStat label="Drafting" value={summary.drafting} />
              <SignalStat label="Review queue" value={summary.reviewQueue} />
              <SignalStat label="Approved" value={summary.approved} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  active,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-blue-600 bg-blue-600 text-white shadow-sm"
          : "border-zinc-200 bg-white/80 text-zinc-900 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-zinc-100 dark:hover:border-zinc-600"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${active ? "text-blue-100" : "text-zinc-500"}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className={`mt-1 text-xs ${active ? "text-blue-100" : "text-zinc-500"}`}>
        {detail}
      </p>
    </button>
  );
}

function SignalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
