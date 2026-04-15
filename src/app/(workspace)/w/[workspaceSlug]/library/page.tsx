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
} from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { LibraryDashboard } from "@/components/library/library-dashboard";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ syncRunId?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { syncRunId } = await searchParams;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const videos = await db
    .select({
      video: sourceVideos,
      channelTitle: youtubeChannels.title,
      ingestStatus: workspaceVideos.ingestStatus,
    })
    .from(workspaceVideos)
    .innerJoin(sourceVideos, eq(sourceVideos.id, workspaceVideos.videoId))
    .leftJoin(youtubeChannels, eq(youtubeChannels.id, sourceVideos.channelId))
    .where(eq(workspaceVideos.workspaceId, workspace.id))
    .orderBy(desc(sourceVideos.publishedAt))
    .limit(100);

  const channels = await db
    .select({ id: workspaceChannels.channelId })
    .from(workspaceChannels)
    .where(eq(workspaceChannels.workspaceId, workspace.id));

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

  // Get project status for each video
  const projectsByVideo = new Map<
    string,
    { id: string; status: string }
  >();

  if (videos.length > 0) {
    const projects = await db
      .select({
        id: contentProjects.id,
        sourceVideoId: contentProjects.sourceVideoId,
        status: contentProjects.status,
      })
      .from(contentProjects)
      .where(eq(contentProjects.workspaceId, workspace.id));

    for (const p of projects) {
      projectsByVideo.set(p.sourceVideoId, { id: p.id, status: p.status });
    }
  }

  return (
    <LibraryDashboard
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.name}
      channelCount={channels.length}
      playlists={playlists}
      syncRunId={syncRunId ?? null}
      videos={videos.map(({ video, channelTitle, ingestStatus }) => ({
        id: video.id,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt?.toISOString() ?? null,
        ingestStatus,
        channelTitle,
        project: projectsByVideo.get(video.id) ?? null,
      }))}
    />
  );
}
