"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { RunStatus } from "@/components/studio/run-status";
import { VideoRow } from "./video-row";
import { FILTER_KEYS, FILTER_LABELS, type FilterKey } from "./library-filters";
import { Pagination } from "@/components/ui/pagination";
import { LatestServiceCard, type LatestService } from "./latest-service-card";

interface LibraryVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  ingestStatus: string;
  captionsReady: boolean;
  liveStatus: string | null;
  scheduledStartAt: string | null;
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
  hasProject: boolean;
  hasReviewActivity: boolean;
}

interface LibraryDashboardProps {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  canEdit: boolean;
  channelCount: number;
  playlists: LibraryPlaylist[];
  syncRunId: string | null;
  needsReconnect: boolean;
  latestService: LatestService | null;
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
      title: "See your videos",
      description: "After connecting, your channel's videos and playlists show up here.",
      done: stats.totalVideos > 0,
      actionLabel: "Open integrations",
      href: "settings/integrations",
    },
    {
      id: "fetch_captions",
      title: "Get captions for a service",
      description: "Pick a service and get its captions from YouTube when you are ready to work on it.",
      done: stats.captionsReady > 0,
      actionLabel: "Show videos without captions",
      filter: "needs_captions" as const,
    },
    {
      id: "generate_draft",
      title: "Start your first post",
      description: "Check the captions, then turn the service into a blog post.",
      done: stats.hasProject,
      actionLabel: "Show videos ready for a post",
      filter: "ready_to_draft" as const,
    },
    {
      id: "start_review",
      title: "Ask someone to approve a post",
      description: "Optional: have someone read a post over before it goes on your website.",
      done: stats.hasReviewActivity,
      actionLabel: "Show posts waiting for approval",
      filter: "review_queue" as const,
    },
  ];
}

export function LibraryDashboard({
  workspaceId,
  workspaceSlug,
  workspaceName,
  canEdit,
  channelCount,
  playlists,
  syncRunId,
  needsReconnect,
  latestService,
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
    <div className="p-4 sm:p-6">
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
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
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
            <div className="w-full md:w-auto md:min-w-[220px]">
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

      <header className="mb-6">
        <p className="text-sm font-medium text-zinc-500">{workspaceName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">
          Services
        </h1>
        <p className="mt-2 max-w-xl text-pretty text-zinc-600 dark:text-zinc-300">
          Pick a service and follow the steps to turn it into a blog post for
          your website.
        </p>
      </header>

      {latestService && (
        <div className="mb-6">
          <LatestServiceCard
            workspaceSlug={workspaceSlug}
            video={latestService}
            canEdit={canEdit}
          />
        </div>
      )}


      <section className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">All videos</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Each video shows its next step. Search or filter to find one.
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
                placeholder="Search by title or channel"
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
                className={`rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition ${
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
                Connect your YouTube channel and its videos will show up here.
              </p>
              <div className="mt-5">
                <a
                  href={`/api/auth/youtube-connect?redirect=${encodeURIComponent(`/w/${workspaceSlug}/library`)}&workspaceId=${encodeURIComponent(workspaceId)}`}
                  className="inline-flex whitespace-nowrap rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
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
              <div className="mt-5 flex flex-wrap justify-center gap-3">
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
                className={`mt-6 overflow-x-auto rounded-2xl border border-zinc-200 transition-opacity dark:border-zinc-800 ${
                  isPending ? "opacity-60" : ""
                }`}
              >
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3 font-medium">Video</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">Channel</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">Date</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">Captions</th>
                      <th className="px-4 py-3 font-medium">Post</th>
                      <th className="px-4 py-3 font-medium">Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map((video) => (
                      <VideoRow
                        key={video.id}
                        workspaceSlug={workspaceSlug}
                        video={{
                          id: video.id,
                          title: video.title,
                          thumbnailUrl: video.thumbnailUrl,
                          publishedAt: video.publishedAt
                            ? new Date(video.publishedAt)
                            : null,
                          ingestStatus: video.ingestStatus,
                          captionsReady: video.captionsReady,
                          liveStatus: video.liveStatus,
                          scheduledStartAt: video.scheduledStartAt,
                        }}
                        channelTitle={video.channelTitle}
                        project={video.project}
                        canEdit={canEdit}
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

        <div className="min-w-0 space-y-6">
          <details className="group rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Playlists</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Your channel&apos;s playlists, brought in from YouTube.
                </p>
              </div>
              <span className="whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                <span className="tabular-nums">{playlists.length}</span>
                <span className="group-open:hidden"> · Show</span>
                <span className="hidden group-open:inline"> · Hide</span>
              </span>
            </summary>
            {playlists.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
                Playlists will appear here as soon as a channel is connected.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{playlist.title}</p>
                        {playlist.kind === "uploads" && (
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            Uploads
                          </span>
                        )}
                      </div>
                      {playlist.channelTitle && (
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {playlist.channelTitle}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-xs tabular-nums text-zinc-500">
                      {playlist.itemCount} video{playlist.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </details>

          {completionPercent < 100 && (
          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Getting started</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Five steps to your first post.
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">{completionPercent}%</p>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
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
                          className="mt-3 inline-flex whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          {item.actionLabel}
                        </Link>
                      )}
                      {!item.done && item.filter && (
                        <button
                          type="button"
                          onClick={() => setFilter(item.filter)}
                          className="mt-3 inline-block max-w-full text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          {item.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </section>
    </div>
  );
}
