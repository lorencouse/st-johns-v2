import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  sourceVideos,
  youtubeChannels,
  youtubePlaylists,
  workspaceVideos,
  workspaceChannels,
  workspacePlaylists,
  contentProjects,
  integrationConnections,
} from "@/server/db/schema";
import { eq, and, or, desc, ilike, isNull, sql, type SQL } from "drizzle-orm";
import {
  hasTranscriptSql,
  captionsReadySql,
} from "@/server/db/transcript-availability";
import { LibraryDashboard } from "@/components/library/library-dashboard";
import { FILTER_KEYS, type FilterKey } from "@/components/library/library-filters";
import { parsePage, parsePageSize, resolvePaging } from "@/lib/pagination";

export const dynamic = "force-dynamic";

function parseFilter(value: string | undefined): FilterKey {
  return FILTER_KEYS.includes(value as FilterKey) ? (value as FilterKey) : "all";
}

/**
 * A scheduled premiere or an in-progress stream. There is no finished audio to
 * fetch captions from, so these are never "needs captions" — they just haven't
 * happened yet.
 */
const isScheduledSql = sql<boolean>`coalesce(${sourceVideos.liveStatus}, 'none') in ('upcoming', 'live')`;

/**
 * SQL predicate for each workflow filter, against the joined video query.
 * Caption state comes from `captionsReadySql`, not the ingest flag alone, so a
 * video that already has a transcript is never listed as needing captions.
 */
const FILTER_CONDITIONS: Record<FilterKey, SQL | undefined> = {
  all: undefined,
  needs_captions: sql`not ${captionsReadySql} and not ${isScheduledSql}`,
  ready_to_draft: and(captionsReadySql, isNull(contentProjects.id)),
  drafting: eq(contentProjects.status, "drafting"),
  review_queue: or(
    eq(contentProjects.status, "ready_for_review"),
    eq(contentProjects.status, "changes_requested")
  ),
  approved: eq(contentProjects.status, "approved"),
  no_project: isNull(contentProjects.id),
};

function countExpr(condition: SQL | undefined) {
  return condition
    ? sql<number>`count(*) filter (where ${condition})::int`
    : sql<number>`count(*)::int`;
}

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{
    syncRunId?: string;
    filter?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const { workspaceSlug } = await params;
  const {
    syncRunId,
    filter: filterParam,
    q: queryParam,
    page: pageParam,
    pageSize: pageSizeParam,
  } = await searchParams;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const activeFilter = parseFilter(filterParam);
  const pageSize = parsePageSize(pageSizeParam);
  const requestedPage = parsePage(pageParam);
  const search = (queryParam ?? "").trim();

  const workspaceCondition = eq(workspaceVideos.workspaceId, workspace.id);
  const searchCondition = search
    ? or(
        ilike(sourceVideos.title, `%${search}%`),
        ilike(youtubeChannels.title, `%${search}%`),
        sql`${contentProjects.status}::text ilike ${`%${search}%`}`
      )
    : undefined;
  const scopeCondition = and(workspaceCondition, searchCondition);

  // One pass over the search scope gives every workflow-filter count, so chips
  // and pagination describe the whole matching library, not just this page.
  const [counts] = await db
    .select({
      all: countExpr(FILTER_CONDITIONS.all),
      needs_captions: countExpr(FILTER_CONDITIONS.needs_captions),
      ready_to_draft: countExpr(FILTER_CONDITIONS.ready_to_draft),
      drafting: countExpr(FILTER_CONDITIONS.drafting),
      review_queue: countExpr(FILTER_CONDITIONS.review_queue),
      approved: countExpr(FILTER_CONDITIONS.approved),
      no_project: countExpr(FILTER_CONDITIONS.no_project),
    })
    .from(workspaceVideos)
    .innerJoin(sourceVideos, eq(sourceVideos.id, workspaceVideos.videoId))
    .leftJoin(youtubeChannels, eq(youtubeChannels.id, sourceVideos.channelId))
    .leftJoin(
      contentProjects,
      and(
        eq(contentProjects.sourceVideoId, sourceVideos.id),
        eq(contentProjects.workspaceId, workspace.id)
      )
    )
    .where(scopeCondition);

  // Checklist and signal stats describe the whole library, so they ignore the
  // current search and filter.
  const [stats] = await db
    .select({
      total: countExpr(undefined),
      captionsReady: countExpr(captionsReadySql),
      drafting: countExpr(eq(contentProjects.status, "drafting")),
      reviewQueue: countExpr(
        or(
          eq(contentProjects.status, "ready_for_review"),
          eq(contentProjects.status, "changes_requested")
        )
      ),
      approved: countExpr(eq(contentProjects.status, "approved")),
      readyToDraft: countExpr(FILTER_CONDITIONS.ready_to_draft),
      withProject: sql<number>`count(${contentProjects.id})::int`,
      reviewActivity: countExpr(
        or(
          eq(contentProjects.status, "ready_for_review"),
          eq(contentProjects.status, "changes_requested"),
          eq(contentProjects.status, "approved")
        )
      ),
    })
    .from(workspaceVideos)
    .innerJoin(sourceVideos, eq(sourceVideos.id, workspaceVideos.videoId))
    .leftJoin(
      contentProjects,
      and(
        eq(contentProjects.sourceVideoId, sourceVideos.id),
        eq(contentProjects.workspaceId, workspace.id)
      )
    )
    .where(workspaceCondition);

  const totalForFilter = counts?.[activeFilter] ?? 0;
  const { page, pageCount, offset } = resolvePaging(
    totalForFilter,
    requestedPage,
    pageSize
  );

  const videos = await db
    .select({
      id: sourceVideos.id,
      title: sourceVideos.title,
      thumbnailUrl: sourceVideos.thumbnailUrl,
      publishedAt: sourceVideos.publishedAt,
      ingestStatus: workspaceVideos.ingestStatus,
      hasTranscript: hasTranscriptSql,
      liveStatus: sourceVideos.liveStatus,
      scheduledStartAt: sourceVideos.scheduledStartAt,
      channelTitle: youtubeChannels.title,
      projectId: contentProjects.id,
      projectStatus: contentProjects.status,
    })
    .from(workspaceVideos)
    .innerJoin(sourceVideos, eq(sourceVideos.id, workspaceVideos.videoId))
    .leftJoin(youtubeChannels, eq(youtubeChannels.id, sourceVideos.channelId))
    .leftJoin(
      contentProjects,
      and(
        eq(contentProjects.sourceVideoId, sourceVideos.id),
        eq(contentProjects.workspaceId, workspace.id)
      )
    )
    .where(and(scopeCondition, FILTER_CONDITIONS[activeFilter]))
    // Secondary key keeps paging stable when videos share a publish date.
    .orderBy(desc(sourceVideos.publishedAt), desc(sourceVideos.id))
    .limit(pageSize)
    .offset(offset);

  const channels = await db
    .select({ id: workspaceChannels.channelId })
    .from(workspaceChannels)
    .where(eq(workspaceChannels.workspaceId, workspace.id));

  const [connection] = await db
    .select({ status: integrationConnections.status })
    .from(integrationConnections)
    .where(eq(integrationConnections.workspaceId, workspace.id))
    .limit(1);
  const needsReconnect = !!connection && connection.status !== "active";

  const rawPlaylists = await db
    .select({
      id: youtubePlaylists.id,
      title: youtubePlaylists.title,
      kind: youtubePlaylists.kind,
      itemCount: youtubePlaylists.itemCount,
      channelTitle: youtubeChannels.title,
    })
    .from(workspacePlaylists)
    .innerJoin(
      youtubePlaylists,
      eq(youtubePlaylists.id, workspacePlaylists.playlistId)
    )
    .leftJoin(youtubeChannels, eq(youtubeChannels.id, youtubePlaylists.channelId))
    .where(eq(workspacePlaylists.workspaceId, workspace.id));

  const playlists = rawPlaylists.sort((a, b) => {
    if (a.kind === "uploads" && b.kind !== "uploads") return -1;
    if (a.kind !== "uploads" && b.kind === "uploads") return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <LibraryDashboard
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.name}
      channelCount={channels.length}
      playlists={playlists}
      syncRunId={syncRunId ?? null}
      needsReconnect={needsReconnect}
      activeFilter={activeFilter}
      query={search}
      page={page}
      pageSize={pageSize}
      pageCount={pageCount}
      totalForFilter={totalForFilter}
      counts={{
        all: counts?.all ?? 0,
        needs_captions: counts?.needs_captions ?? 0,
        ready_to_draft: counts?.ready_to_draft ?? 0,
        drafting: counts?.drafting ?? 0,
        review_queue: counts?.review_queue ?? 0,
        approved: counts?.approved ?? 0,
        no_project: counts?.no_project ?? 0,
      }}
      stats={{
        totalVideos: stats?.total ?? 0,
        captionsReady: stats?.captionsReady ?? 0,
        readyToDraft: stats?.readyToDraft ?? 0,
        drafting: stats?.drafting ?? 0,
        reviewQueue: stats?.reviewQueue ?? 0,
        approved: stats?.approved ?? 0,
        hasProject: (stats?.withProject ?? 0) > 0,
        hasReviewActivity: (stats?.reviewActivity ?? 0) > 0,
      }}
      videos={videos.map((row) => ({
        id: row.id,
        title: row.title,
        thumbnailUrl: row.thumbnailUrl,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        // An existing transcript is the ground truth: report captions as
        // available even when the stored flag was never advanced.
        ingestStatus: row.hasTranscript ? "captions_available" : row.ingestStatus,
        liveStatus: row.liveStatus,
        scheduledStartAt: row.scheduledStartAt?.toISOString() ?? null,
        channelTitle: row.channelTitle,
        project:
          row.projectId && row.projectStatus
            ? { id: row.projectId, status: row.projectStatus }
            : null,
      }))}
    />
  );
}
