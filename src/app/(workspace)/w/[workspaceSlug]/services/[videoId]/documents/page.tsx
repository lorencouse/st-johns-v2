import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  contentProjects,
  serviceDocuments,
  sourceVideos,
  workspaceVideos,
} from "@/server/db/schema";
import { documentSummary } from "@/server/documents/summary";
import { hasTranscriptSql } from "@/server/db/transcript-availability";
import { isStorageConfigured } from "@/server/storage/r2";
import { DocumentsClient } from "@/components/service/documents-client";

export const dynamic = "force-dynamic";

/** Optional step: attach the sermon, the bulletin, or anything else. */
export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; videoId: string }>;
}) {
  const { workspaceSlug, videoId } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  if (!["owner", "admin", "editor"].includes(role)) {
    redirect(`/w/${workspaceSlug}/services/${videoId}`);
  }

  const [row] = await db
    .select({
      title: sourceVideos.title,
      projectId: contentProjects.id,
      ingestStatus: workspaceVideos.ingestStatus,
      hasTranscript: hasTranscriptSql,
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

  const documents = await db
    .select(documentSummary)
    .from(serviceDocuments)
    .where(
      and(
        eq(serviceDocuments.workspaceId, workspace.id),
        eq(serviceDocuments.sourceVideoId, videoId)
      )
    )
    .orderBy(asc(serviceDocuments.createdAt));

  return (
    <DocumentsClient
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      videoId={videoId}
      videoTitle={row.title}
      projectId={row.projectId}
      captionsReady={row.hasTranscript || row.ingestStatus === "captions_available"}
      storageReady={isStorageConfigured()}
      initialDocuments={documents.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
