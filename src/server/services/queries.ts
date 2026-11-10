import { db } from "@/server/db";
import {
  contentProjects,
  serviceDocuments,
  sourceVideos,
  workspaceVideos,
  youtubeChannels,
} from "@/server/db/schema";
import { captionsReadySql } from "@/server/db/transcript-availability";
import { and, count, eq } from "drizzle-orm";

/** The video's row in this workspace, or undefined if it is not in the workspace. */
export async function findWorkspaceVideo(workspaceId: string, videoId: string) {
  const [row] = await db
    .select()
    .from(workspaceVideos)
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspaceId),
        eq(workspaceVideos.videoId, videoId)
      )
    )
    .limit(1);
  return row;
}

/** Join conditions from a workspace video to its source, channel and post. */
export const videoSourceJoin = eq(sourceVideos.id, workspaceVideos.videoId);
export const videoChannelJoin = eq(youtubeChannels.id, sourceVideos.channelId);
export function videoPostJoin(workspaceId: string) {
  return and(
    eq(contentProjects.sourceVideoId, sourceVideos.id),
    eq(contentProjects.workspaceId, workspaceId)
  );
}

/** What the guided steps of one service need to know about it. */
export async function loadServiceContext(workspaceId: string, videoId: string) {
  const [row] = await db
    .select({
      title: sourceVideos.title,
      thumbnailUrl: sourceVideos.thumbnailUrl,
      publishedAt: sourceVideos.publishedAt,
      liveStatus: sourceVideos.liveStatus,
      ingestStatus: workspaceVideos.ingestStatus,
      captionsReady: captionsReadySql,
      projectId: contentProjects.id,
    })
    .from(workspaceVideos)
    .innerJoin(sourceVideos, videoSourceJoin)
    .leftJoin(contentProjects, videoPostJoin(workspaceId))
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspaceId),
        eq(workspaceVideos.videoId, videoId)
      )
    )
    .limit(1);
  return row;
}

/** How many of the service's uploaded documents have readable text. */
export async function countReadableDocuments(workspaceId: string, videoId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(serviceDocuments)
    .where(
      and(
        eq(serviceDocuments.workspaceId, workspaceId),
        eq(serviceDocuments.sourceVideoId, videoId),
        eq(serviceDocuments.textStatus, "done")
      )
    );
  return value;
}
