import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  sourceVideos,
  youtubeChannels,
  workspaceVideos,
  workspaceChannels,
  contentProjects,
} from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { LibraryDashboard } from "@/components/library/library-dashboard";

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
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
