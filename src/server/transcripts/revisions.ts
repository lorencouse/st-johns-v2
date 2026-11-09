import type { db } from "@/server/db";
import {
  transcriptRevisions,
  transcriptSegments,
  workspaceVideos,
} from "@/server/db/schema";
import { and, eq, max } from "drizzle-orm";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type RevisionKind = (typeof transcriptRevisions.$inferSelect)["revisionKind"];

/**
 * The highest revision number this video has. Locks the video's row first, so
 * two saves at once take turns instead of claiming the same next number.
 */
export async function latestRevisionNumber(
  tx: Transaction,
  workspaceId: string,
  videoId: string
): Promise<number> {
  await tx
    .select({ videoId: workspaceVideos.videoId })
    .from(workspaceVideos)
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspaceId),
        eq(workspaceVideos.videoId, videoId)
      )
    )
    .for("update");

  const [{ latest }] = await tx
    .select({ latest: max(transcriptRevisions.revisionNumber) })
    .from(transcriptRevisions)
    .where(
      and(
        eq(transcriptRevisions.workspaceId, workspaceId),
        eq(transcriptRevisions.videoId, videoId)
      )
    );
  return latest ?? 0;
}

/** Writes one transcript revision and its segments, inside the caller's transaction. */
export async function saveTranscriptRevision(
  tx: Transaction,
  revision: {
    workspaceId: string;
    videoId: string;
    revisionKind: RevisionKind;
    revisionNumber: number;
    sourceTrackId?: string;
    basedOnRevisionId?: string;
    createdByUserId: string;
    segments: Array<{ startMs: number; endMs: number; text: string }>;
  }
) {
  const { segments, ...values } = revision;
  const [saved] = await tx
    .insert(transcriptRevisions)
    .values({
      ...values,
      languageCode: "en",
      segmentCount: segments.length,
      wordCount: segments.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0),
    })
    .returning();

  if (segments.length > 0) {
    await tx.insert(transcriptSegments).values(
      segments.map((s, seq) => ({ ...s, revisionId: saved.id, seq }))
    );
  }
  return saved;
}

/**
 * The revision a post is written from: a person's edits first, then the
 * cleaned text, then the normalized text, then the newest of whatever exists.
 * Expects the revisions newest first.
 */
export function pickSourceRevision<T extends { revisionKind: string }>(
  revisions: T[]
): T | undefined {
  return (
    revisions.find((r) => r.revisionKind === "human_edited") ??
    revisions.find((r) => r.revisionKind === "cleaned") ??
    revisions.find((r) => r.revisionKind === "normalized") ??
    revisions[0]
  );
}
