import { db } from "@/server/db";
import {
  contentProjects,
  draftVersions,
  transcriptRevisions,
  transcriptSegments,
  sourceVideos,
  workspaceVideos,
  appRuns,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { redoBlockReason } from "@/server/content/redo-guard";
import { aiCleanup, generateSummary } from "@/server/ai/cleanup";
import { generateStructure } from "@/server/ai/structure";
import {
  buildBlocks,
  blocksToContentJson,
  blocksToPlainText,
} from "@/server/content/document";
import type { CaptionSegment } from "@/server/youtube/api";

export interface DraftGeneratePayload {
  workspaceId: string;
  videoId: string; // YouTube video ID
  userId: string;
  runId: string;
  projectId?: string; // if creating draft for existing project
  /**
   * Refuse to replace an active draft that is under review, approved, or
   * edited by a person (see redo-guard). Batch regeneration sets this.
   */
  keepEditedDrafts?: boolean;
}

/** The project's active draft must be kept; nothing was written. */
export class DraftProtectedError extends Error {
  constructor(reason: string) {
    super(`Kept existing draft: ${reason}`);
    this.name = "DraftProtectedError";
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Throw DraftProtectedError when the video's project has an active draft a
 * regeneration must not replace. `lock` holds the project row until the
 * surrounding transaction ends, so an approval cannot slip in between the
 * check and the write.
 */
async function assertReplaceable(
  conn: typeof db | Tx,
  workspaceId: string,
  videoId: string,
  lock: boolean
) {
  const query = conn
    .select({
      project: contentProjects,
      draft: draftVersions,
    })
    .from(contentProjects)
    .leftJoin(
      draftVersions,
      eq(draftVersions.id, contentProjects.activeDraftVersionId)
    )
    .where(
      and(
        eq(contentProjects.workspaceId, workspaceId),
        eq(contentProjects.sourceVideoId, videoId)
      )
    )
    .limit(1);
  const [row] = lock ? await query.for("update", { of: contentProjects }) : await query;
  if (!row) return;
  const reason = redoBlockReason(row.project, row.draft);
  if (reason) throw new DraftProtectedError(reason);
}

export async function handleDraftGenerate(payload: DraftGeneratePayload) {
  const { workspaceId, videoId, userId, runId } = payload;

  await db
    .update(appRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(appRuns.id, runId));

  try {
    // 1. Get video info (verify it belongs to workspace via junction table)
    const [result] = await db
      .select({ video: sourceVideos })
      .from(workspaceVideos)
      .innerJoin(sourceVideos, eq(sourceVideos.id, workspaceVideos.videoId))
      .where(
        and(
          eq(workspaceVideos.videoId, videoId),
          eq(workspaceVideos.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!result) throw new Error("Video not found");
    const video = result.video;

    // Check before paying for the AI passes; rechecked under lock below.
    if (payload.keepEditedDrafts) {
      await assertReplaceable(db, workspaceId, videoId, false);
    }

    // 2. Get the best available transcript revision (prefer human_edited > cleaned > normalized > raw)
    const revisions = await db
      .select()
      .from(transcriptRevisions)
      .where(
        and(
          eq(transcriptRevisions.videoId, videoId),
          eq(transcriptRevisions.workspaceId, workspaceId)
        )
      )
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

    // 5. Generate intro + summary and the section outline. Neither depends on
    // the other, and both are non-fatal, so they run together.
    console.log(
      `[draft-generate] Generating summary and structure for ${video.title}`
    );
    const [summaryResult, structureResult] = await Promise.all([
      generateSummary(cleanupResult.paragraphs),
      generateStructure(cleanupResult.paragraphs),
    ]);

    // 6. Build the Tiptap document with section headings interleaved
    const blocks = buildBlocks(
      cleanupResult.paragraphs,
      structureResult.sections
    );
    const contentJson = blocksToContentJson(blocks);
    const plainText = blocksToPlainText(blocks);
    const draftTitle = structureResult.title || video.title;

    console.log(
      `[draft-generate] ${cleanupResult.paragraphs.length} paragraphs, ${structureResult.sections.length} section(s)`
    );

    // 7. Persist atomically: reuse the video's project if one exists
    // (unique on workspace + sourceVideo prevents duplicates under races),
    // add the next draft version, and point the project at it.
    const { projectId, draftId, nextVersion } = await db.transaction(
      async (tx) => {
        let projectId = payload.projectId ?? null;

        if (!projectId) {
          const [inserted] = await tx
            .insert(contentProjects)
            .values({
              workspaceId,
              sourceVideoId: videoId,
              title: draftTitle,
              status: "drafting",
              createdByUserId: userId,
            })
            .onConflictDoNothing({
              target: [
                contentProjects.workspaceId,
                contentProjects.sourceVideoId,
              ],
            })
            .returning();

          if (inserted) {
            projectId = inserted.id;
          } else {
            const [existing] = await tx
              .select({ id: contentProjects.id })
              .from(contentProjects)
              .where(
                and(
                  eq(contentProjects.workspaceId, workspaceId),
                  eq(contentProjects.sourceVideoId, videoId)
                )
              )
              .limit(1);
            projectId = existing.id;
          }
        }

        if (payload.keepEditedDrafts) {
          await assertReplaceable(tx, workspaceId, videoId, true);
        }

        const existingDrafts = await tx
          .select({ versionNumber: draftVersions.versionNumber })
          .from(draftVersions)
          .where(eq(draftVersions.contentProjectId, projectId))
          .orderBy(desc(draftVersions.versionNumber))
          .limit(1);

        const nextVersion =
          existingDrafts.length > 0 ? existingDrafts[0].versionNumber + 1 : 1;

        const [draft] = await tx
          .insert(draftVersions)
          .values({
            workspaceId,
            contentProjectId: projectId,
            sourceTranscriptRevisionId: sourceRevision.id,
            versionNumber: nextVersion,
            status: "working",
            title: draftTitle,
            intro: summaryResult.intro || null,
            summary: summaryResult.summary || null,
            contentJson,
            plainText,
            metadataJson: {
              aiModel: cleanupResult.aiModel,
              cleanupTokens: cleanupResult.tokensUsed,
              summaryTokens: summaryResult.tokensUsed,
              structureTokens: structureResult.tokensUsed,
              degradedChunks: cleanupResult.degradedChunks,
              sections: structureResult.sections,
              generatedTitle: structureResult.title,
              sourceVideoTitle: video.title,
            },
            createdByUserId: userId,
          })
          .returning();

        await tx
          .update(contentProjects)
          .set({
            activeDraftVersionId: draft.id,
            updatedAt: new Date(),
          })
          .where(eq(contentProjects.id, projectId));

        await tx
          .update(appRuns)
          .set({
            status: "succeeded",
            finishedAt: new Date(),
            outputJson: {
              projectId,
              draftVersionId: draft.id,
              versionNumber: nextVersion,
              paragraphCount: cleanupResult.paragraphs.length,
              sectionCount: structureResult.sections.length,
              cleanupTokens: cleanupResult.tokensUsed,
              summaryTokens: summaryResult.tokensUsed,
              structureTokens: structureResult.tokensUsed,
            },
          })
          .where(eq(appRuns.id, runId));

        return { projectId, draftId: draft.id, nextVersion };
      }
    );

    console.log(
      `[draft-generate] Created draft v${nextVersion} (${draftId}) for project ${projectId}`
    );
  } catch (error) {
    if (error instanceof DraftProtectedError) {
      await db
        .update(appRuns)
        .set({
          status: "cancelled",
          finishedAt: new Date(),
          outputJson: { skipped: error.message },
        })
        .where(eq(appRuns.id, runId));
      throw error;
    }
    // Failure state is written by the worker's final-failure handler.
    console.error(`[draft-generate] Failed:`, error);
    throw error;
  }
}
