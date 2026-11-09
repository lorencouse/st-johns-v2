import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  contentProjects,
  sourceVideos,
  workspaceVideos,
} from "@/server/db/schema";
import { hasTranscriptSql } from "@/server/db/transcript-availability";
import { CheckVideoClient } from "@/components/service/check-video-client";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Step 1 of a service's guided path: confirm the video and get its captions. */
export default async function ServicePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; videoId: string }>;
}) {
  const { workspaceSlug, videoId } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  const [row] = await db
    .select({
      title: sourceVideos.title,
      thumbnailUrl: sourceVideos.thumbnailUrl,
      publishedAt: sourceVideos.publishedAt,
      liveStatus: sourceVideos.liveStatus,
      ingestStatus: workspaceVideos.ingestStatus,
      hasTranscript: hasTranscriptSql,
      projectId: contentProjects.id,
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
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspace.id),
        eq(workspaceVideos.videoId, videoId)
      )
    )
    .limit(1);

  if (!row) notFound();

  return (
    <CheckVideoClient
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      videoId={videoId}
      title={row.title}
      thumbnailUrl={row.thumbnailUrl}
      publishedAt={row.publishedAt?.toISOString() ?? null}
      captionsReady={
        row.hasTranscript || row.ingestStatus === "captions_available"
      }
      captionsFailed={row.ingestStatus === "ingest_failed"}
      notAiredYet={row.liveStatus === "upcoming" || row.liveStatus === "live"}
      canEdit={can(role, "edit")}
      projectId={row.projectId}
    />
  );
}
