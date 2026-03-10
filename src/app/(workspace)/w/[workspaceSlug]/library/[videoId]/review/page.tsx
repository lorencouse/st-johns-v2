import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  sourceVideos,
  transcriptRevisions,
  transcriptSegments,
} from "@/server/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TranscriptReviewClient } from "@/components/library/transcript-review-client";

export default async function TranscriptReviewPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; videoId: string }>;
}) {
  const { workspaceSlug, videoId } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  if (!["owner", "admin", "editor"].includes(role)) {
    notFound();
  }

  // Load video
  const [video] = await db
    .select()
    .from(sourceVideos)
    .where(
      and(
        eq(sourceVideos.id, videoId),
        eq(sourceVideos.workspaceId, workspace.id)
      )
    )
    .limit(1);

  if (!video || video.ingestStatus !== "captions_available") {
    notFound();
  }

  // Load all revisions for this video
  const revisions = await db
    .select()
    .from(transcriptRevisions)
    .where(eq(transcriptRevisions.videoId, videoId))
    .orderBy(desc(transcriptRevisions.revisionNumber));

  // Raw segments (for left pane)
  const rawRevision = revisions.find(
    (r) => r.revisionKind === "raw_caption_import"
  );

  // For the review page, prefer a previous human edit; otherwise start from raw
  // so the user sees all segments and can decide what to keep/remove
  const editableRevision =
    revisions.find((r) => r.revisionKind === "human_edited") ||
    rawRevision;

  if (!rawRevision || !editableRevision) {
    notFound();
  }

  const [rawSegments, editableSegments] = await Promise.all([
    db
      .select({
        seq: transcriptSegments.seq,
        startMs: transcriptSegments.startMs,
        endMs: transcriptSegments.endMs,
        text: transcriptSegments.text,
      })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.revisionId, rawRevision.id))
      .orderBy(transcriptSegments.seq),
    db
      .select({
        seq: transcriptSegments.seq,
        startMs: transcriptSegments.startMs,
        endMs: transcriptSegments.endMs,
        text: transcriptSegments.text,
      })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.revisionId, editableRevision.id))
      .orderBy(transcriptSegments.seq),
  ]);

  return (
    <TranscriptReviewClient
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      videoId={videoId}
      videoTitle={video.title}
      providerVideoId={video.providerVideoId}
      rawSegments={rawSegments}
      editableSegments={editableSegments}
    />
  );
}
