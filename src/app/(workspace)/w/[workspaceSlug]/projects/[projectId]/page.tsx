import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  contentProjects,
  draftVersions,
  sourceVideos,
  transcriptRevisions,
  transcriptSegments,
} from "@/server/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StudioClient } from "@/components/studio/studio-client";
import { pickSourceRevision } from "@/server/transcripts/revisions";
import { countReadableDocuments } from "@/server/services/queries";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
}) {
  const { workspaceSlug, projectId } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  // Load project + video
  const [result] = await db
    .select({
      project: contentProjects,
      videoTitle: sourceVideos.title,
      videoId: sourceVideos.id,
    })
    .from(contentProjects)
    .innerJoin(
      sourceVideos,
      eq(sourceVideos.id, contentProjects.sourceVideoId)
    )
    .where(
      and(
        eq(contentProjects.id, projectId),
        eq(contentProjects.workspaceId, workspace.id)
      )
    )
    .limit(1);

  if (!result) notFound();

  // Load active draft
  let draft: {
    id: string;
    versionNumber: number;
    status: string;
    title: string;
    intro: string | null;
    summary: string | null;
    contentJson: Record<string, unknown>;
  } | null = null;

  if (result.project.activeDraftVersionId) {
    const [draftRow] = await db
      .select()
      .from(draftVersions)
      .where(eq(draftVersions.id, result.project.activeDraftVersionId))
      .limit(1);

    if (draftRow) {
      draft = {
        id: draftRow.id,
        versionNumber: draftRow.versionNumber,
        status: draftRow.status,
        title: draftRow.title,
        intro: draftRow.intro,
        summary: draftRow.summary,
        contentJson: draftRow.contentJson as Record<string, unknown>,
      };
    }
  }

  // Load transcript segments (from the latest cleaned or normalized revision)
  const revisions = await db
    .select()
    .from(transcriptRevisions)
    .where(
      and(
        eq(transcriptRevisions.videoId, result.videoId),
        eq(transcriptRevisions.workspaceId, workspace.id)
      )
    )
    .orderBy(desc(transcriptRevisions.revisionNumber));

  const sourceRevision = pickSourceRevision(revisions);

  let segments: Array<{
    seq: number;
    startMs: number;
    endMs: number;
    text: string;
  }> = [];

  if (sourceRevision) {
    const rows = await db
      .select({
        seq: transcriptSegments.seq,
        startMs: transcriptSegments.startMs,
        endMs: transcriptSegments.endMs,
        text: transcriptSegments.text,
      })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.revisionId, sourceRevision.id))
      .orderBy(transcriptSegments.seq);

    segments = rows;
  }

  // Documents with readable text, for checking the post against them.
  const documentCount = await countReadableDocuments(workspace.id, result.videoId);

  return (
    <StudioClient
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      projectTitle={result.project.title}
      projectStatus={result.project.status}
      videoTitle={result.videoTitle}
      videoId={result.videoId}
      draft={draft}
      transcriptSegments={segments}
      userRole={role}
      documentCount={documentCount}
    />
  );
}
