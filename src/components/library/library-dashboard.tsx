"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { RunStatus } from "@/components/studio/run-status";
import { VideoRow } from "./video-row";
import { FILTER_KEYS, FILTER_LABELS, type FilterKey } from "./library-filters";
import { Pagination } from "@/components/ui/pagination";

interface LibraryVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  ingestStatus: string;
  channelTitle: string | null;
  project: { id: string; status: string } | null;
}

interface LibraryPlaylist {
  id: string;
  title: string;
  kind: string;
  itemCount: number;
  channelTitle: string | null;
}

interface LibraryStats {
  totalVideos: number;
  captionsReady: number;
  readyToDraft: number;
  drafting: number;
  reviewQueue: number;
  approved: number;
  hasProject: boolean;
  hasReviewActivity: boolean;
}

interface LibraryDashboardProps {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  channelCount: number;
  playlists: LibraryPlaylist[];
  syncRunId: string | null;
  needsReconnect: boolean;
  activeFilter: FilterKey;
  query: string;
  page: number;
  pageSize: number;
  pageCount: number;
  totalForFilter: number;
  counts: Record<FilterKey, number>;
  stats: LibraryStats;
  videos: LibraryVideo[];
}

function buildChecklist(
  stats: LibraryStats,
  channelCount: number
) {
  return [
    {
      id: "connect_channel",
      title: "Connect a YouTube channel",
      description: "Grant YouTube access so the workspace can import the channel library.",
      done: channelCount > 0,
      actionLabel: "Open integrations",
      href: "settings/integrations",
    },
    {
      id: "sync_videos",
      title: "See videos and playlists",
      description: "After connecting, the workspace should show imported uploads and playlists.",
      done: stats.totalVideos > 0,
      actionLabel: "Open integrations",
      href: "settings/integrations",
    },
    {
      id: "fetch_captions",
      title: "Fetch captions for a video",
      description: "Choose a video from the library and pull its captions when you are ready to work on it.",
      done: stats.captionsReady > 0,
      actionLabel: "Show videos needing captions",
      filter: "needs_captions" as const,
    },
    {
      id: "generate_draft",
      title: "Start your first project",
      description: "Review the transcript, then create a project from that video.",
      done: stats.hasProject,
      actionLabel: "Show caption-ready videos",
      filter: "ready_to_draft" as const,
    },
    {
      id: "start_review",
      title: "Send one item to review",
      description: "Use review to turn drafting into a repeatable publishing process.",
      done: stats.hasReviewActivity,
      actionLabel: "Open review queue",
      href: "review",
    },
  ];
}

export function LibraryDashboard({
  workspaceId,
  workspaceSlug,
  workspaceName,
  channelCount,
  playlists,
  syncRunId,
  needsReconnect,
  activeFilter,
  query,
  page,
  pageSize,
  pageCount,
  totalForFilter,
  counts,
  stats,
  videos,
}: LibraryDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingRunId, setPendingRunId] = useState(syncRunId);
  const [searchInput, setSearchInput] = useState(query);

  // Keep the box in sync when the URL changes from elsewhere (back button,
  // "clear search") by adjusting state during render rather than in an effect.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setSearchInput(query);
  }

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const search = params.toString();
      startTransition(() => {
        router.replace(search ? `${pathname}?${search}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams]
  );

  // Debounce typing so each keystroke does not hit the database.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      pushParams({ q: next || null, page: null });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, query, pushParams]);

  const setFilter = (filter: FilterKey) =>
    pushParams({ filter: filter === "all" ? null : filter, page: null });

  const hasVideos = stats.totalVideos > 0;
  const checklist = buildChecklist(stats, channelCount);
  const completedChecklistCount = checklist.filter((item) => item.done).length;
  const completionPercent = Math.round(
    (completedChecklistCount / checklist.length) * 100
  );

  return (
    <div className="p-6">
      {needsReconnect && (
        <section className="mb-6 rounded-[24px] border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                YouTube connection expired
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                Google revoked or expired this workspace&apos;s YouTube access.
                Reconnect to keep syncing videos and fetching captions.
              </p>
            </div>
            <a
              href={`/api/auth/youtube-connect?workspaceId=${workspaceId}&redirect=${encodeURIComponent(`/w/${workspaceSlug}/library`)}`}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Reconnect YouTube
            </a>
          </div>
        </section>
      )}

      {pendingRunId && (
        <section className="mb-6 rounded-[24px] border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Importing channel videos
              </p>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-200">
                The channel link succeeded. This page will refresh as soon as the
                imported videos and playlists are ready.
              </p>
            </div>
            <div className="min-w-[220px]">
              <RunStatus
                runId={pendingRunId}
                onSuccess={() => {
                  setPendingRunId(null);
                  router.replace(`/w/${workspaceSlug}/library`);
                  router.refresh();
                }}
                onDismiss={() => {
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
              Start with the imported channel library, pick a video to fetch captions,
              then turn that reviewed transcript into a project when you are ready.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Videos in library"
              value={stats.totalVideos}
              detail={`${channelCount} synced channel${channelCount === 1 ? "" : "s"}`}
              active={activeFilter === "all"}
              onClick={() => setFilter("all")}
            />
            <SummaryCard
              label="Ready to draft"
              value={stats.readyToDraft}
              detail="Captions available, project not started"
              active={activeFilter === "ready_to_draft"}
              onClick={() => setFilter("ready_to_draft")}
            />
            <SummaryCard
              label="In review"
              value={stats.reviewQueue}
              detail="Ready for review or changes requested"
              active={activeFilter === "review_queue"}
              onClick={() => setFilter("review_queue")}
            />
            <SummaryCard
              label="Approved"
              value={stats.approved}
              detail="Completed editorial flow"
              active={activeFilter === "approved"}
              onClick={() => setFilter("approved")}
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
                Browse imported videos, then focus on the next step for each one.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <label htmlFor="library-search" className="sr-only">
                Search library
              </label>
              <input
                id="library-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search titles, channels, or statuses"
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTER_KEYS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setFilter(filter)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeFilter === filter
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
                }`}
              >
                {FILTER_LABELS[filter]} ({counts[filter]})
              </button>
            ))}
          </div>

          {!hasVideos ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <h3 className="text-lg font-semibold">Your library is empty</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Connect YouTube and the workspace will import the channel&apos;s videos
                and playlists here for you to work through manually.
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
          ) : videos.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <h3 className="text-lg font-semibold">No videos match this view</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Try clearing the search or switching to a broader workflow
                filter.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    pushParams({ q: null, page: null });
                  }}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Clear search
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Show all videos
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`mt-6 overflow-hidden rounded-2xl border border-zinc-200 transition-opacity dark:border-zinc-800 ${
                  isPending ? "opacity-60" : ""
                }`}
              >
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
                    {videos.map((video) => (
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

              <Pagination
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                total={totalForFilter}
                label="video"
              />
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Playlists</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Imported with the channel so the library shows both uploads and playlist structure immediately.
                </p>
              </div>
              <p className="text-2xl font-semibold">{playlists.length}</p>
            </div>
            {playlists.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
                Playlists will appear here as soon as a channel is connected.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{playlist.title}</p>
                        {playlist.kind === "uploads" && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            Uploads
                          </span>
                        )}
                      </div>
                      {playlist.channelTitle && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {playlist.channelTitle}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-zinc-500">
                      {playlist.itemCount} video{playlist.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Setup checklist</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Keep the workflow explicit: import library, choose a video, fetch captions, then start a project.
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
              {checklist.map((item, index) => (
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
                          onClick={() => setFilter(item.filter)}
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
                <SignalStat label="Captions ready" value={stats.captionsReady} />
                <SignalStat label="Drafting" value={stats.drafting} />
                <SignalStat label="Review queue" value={stats.reviewQueue} />
                <SignalStat label="Approved" value={stats.approved} />
              </div>
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
