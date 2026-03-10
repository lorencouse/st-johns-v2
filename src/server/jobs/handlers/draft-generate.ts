import { db } from "@/server/db";
import {
  contentProjects,
  draftVersions,
  transcriptRevisions,
  transcriptSegments,
  sourceVideos,
  appRuns,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { aiCleanup, generateSummary } from "@/server/ai/cleanup";
import type { CaptionSegment } from "@/server/youtube/api";

export interface DraftGeneratePayload {
  workspaceId: string;
  videoId: string; // our DB UUID
  userId: string;
  runId: string;
  projectId?: string; // if creating draft for existing project
}

export async function handleDraftGenerate(payload: DraftGeneratePayload) {
  const { workspaceId, videoId, userId, runId } = payload;

  await db
    .update(appRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(appRuns.id, runId));

  try {
    // 1. Get video info
    const [video] = await db
      .select()
      .from(sourceVideos)
      .where(eq(sourceVideos.id, videoId))
      .limit(1);

    if (!video) throw new Error("Video not found");

    // 2. Get the best available transcript revision (prefer human_edited > cleaned > normalized > raw)
    const revisions = await db
      .select()
      .from(transcriptRevisions)
      .where(eq(transcriptRevisions.videoId, videoId))
      .orderBy(desc(transcriptRevisions.revisionNumber));

    const sourceRevision =
      revisions.find((r) => r.revisionKind === "human_edited") ||
      revisions.find((r) => r.revisionKind === "cleaned") ||
      revisions.find((r) => r.revisionKind === "normalized") ||
      revisions[0];

    if (!sourceRevision) {
      throw new Error("No transcript revision found. Ingest the video first.");
    }

    // 3. Load segments from source revision
    const segments = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.revisionId, sourceRevision.id))
      .orderBy(transcriptSegments.seq);

    if (segments.length === 0) {
      throw new Error("Transcript revision has no segments");
    }

    // Convert to CaptionSegment format for AI cleanup
    const captionSegments: CaptionSegment[] = segments.map((s) => ({
      start: s.startMs / 1000,
      end: s.endMs / 1000,
      text: s.text,
    }));

    // 4. Run AI cleanup
    console.log(`[draft-generate] Running AI cleanup for ${video.title}`);
    const cleanupResult = await aiCleanup(captionSegments);

    // 5. Generate intro + summary
    console.log(`[draft-generate] Generating summary for ${video.title}`);
    const summaryResult = await generateSummary(cleanupResult.paragraphs);

    // 6. Create or get content project
    let projectId = payload.projectId;

    if (!projectId) {
      const [project] = await db
        .insert(contentProjects)
        .values({
          workspaceId,
          sourceVideoId: videoId,
          title: video.title,
          status: "drafting",
          createdByUserId: userId,
        })
        .returning();
      projectId = project.id;
    }

    // 7. Build Tiptap-compatible content JSON
    const contentJson = {
      type: "doc",
      content: cleanupResult.paragraphs.map((p) => ({
        type: "paragraph",
        attrs: { timestamp: p.timestamp },
        content: [{ type: "text", text: p.text }],
      })),
    };

    const plainText = cleanupResult.paragraphs
      .map((p) => p.text)
      .join("\n\n");

    // 8. Determine version number
    const existingDrafts = await db
      .select({ versionNumber: draftVersions.versionNumber })
      .from(draftVersions)
      .where(eq(draftVersions.contentProjectId, projectId))
      .orderBy(desc(draftVersions.versionNumber))
      .limit(1);

    const nextVersion =
      existingDrafts.length > 0 ? existingDrafts[0].versionNumber + 1 : 1;

    // 9. Create draft version
    const [draft] = await db
      .insert(draftVersions)
      .values({
        workspaceId,
        contentProjectId: projectId,
        sourceTranscriptRevisionId: sourceRevision.id,
        versionNumber: nextVersion,
        status: "working",
        title: video.title,
        intro: summaryResult.intro || null,
        summary: summaryResult.summary || null,
        contentJson,
        plainText,
        metadataJson: {
          aiModel: cleanupResult.aiModel,
          cleanupTokens: cleanupResult.tokensUsed,
          summaryTokens: summaryResult.tokensUsed,
        },
        createdByUserId: userId,
      })
      .returning();

    // 10. Update project to point to this draft
    await db
      .update(contentProjects)
      .set({
        activeDraftVersionId: draft.id,
        updatedAt: new Date(),
      })
      .where(eq(contentProjects.id, projectId));

    // 11. Mark run succeeded
    await db
      .update(appRuns)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        outputJson: {
          projectId,
          draftVersionId: draft.id,
          versionNumber: nextVersion,
          paragraphCount: cleanupResult.paragraphs.length,
          cleanupTokens: cleanupResult.tokensUsed,
          summaryTokens: summaryResult.tokensUsed,
        },
      })
      .where(eq(appRuns.id, runId));

    console.log(
      `[draft-generate] Created draft v${nextVersion} for project ${projectId}`
    );
  } catch (error) {
    console.error(`[draft-generate] Failed:`, error);

    await db
      .update(appRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(appRuns.id, runId));

    throw error;
  }
}
