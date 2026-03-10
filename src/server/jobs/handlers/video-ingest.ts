import { db } from "@/server/db";
import {
  sourceVideos,
  captionTracks,
  transcriptRevisions,
  transcriptSegments,
  appRuns,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getGoogleAccessToken } from "@/server/auth/google-token";
import { fetchCaptions } from "@/server/youtube/api";
import { transcribeWithWhisper } from "@/server/youtube/transcribe";
import {
  filterNoise,
  mergeIntoParagraphs,
  noAiCleanup,
} from "@/server/ai/cleanup";

export interface VideoIngestPayload {
  workspaceId: string;
  videoId: string; // our DB UUID
  providerVideoId: string;
  userId: string;
  runId: string;
  allowWhisperFallback?: boolean;
}

export async function handleVideoIngest(payload: VideoIngestPayload) {
  const { workspaceId, videoId, providerVideoId, userId, runId } = payload;

  await db
    .update(appRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(appRuns.id, runId));

  try {
    // 1. Try YouTube captions first (requires youtube.force-ssl scope)
    let segments;
    const accessToken = await getGoogleAccessToken(userId);

    if (accessToken) {
      try {
        console.log(`[video-ingest] Trying YouTube captions for ${providerVideoId}`);
        segments = await fetchCaptions(providerVideoId, accessToken);
      } catch (captionErr) {
        console.log(`[video-ingest] YouTube captions failed, falling back to Whisper: ${captionErr instanceof Error ? captionErr.message : captionErr}`);
      }
    }

    // 2. Fall back to Whisper (admin/paid users only)
    if (!segments || segments.length === 0) {
      if (!payload.allowWhisperFallback) {
        throw new Error("YouTube captions unavailable and Whisper fallback not enabled for this user");
      }
      console.log(`[video-ingest] Transcribing ${providerVideoId} with Whisper`);
      segments = await transcribeWithWhisper(providerVideoId);
    }

    // 2. Store caption track record
    const [track] = await db
      .insert(captionTracks)
      .values({
        workspaceId,
        videoId,
        languageCode: "en",
        kind: "unknown",
        isDefault: true,
      })
      .returning();

    // 3. Create raw transcript revision
    const [rawRevision] = await db
      .insert(transcriptRevisions)
      .values({
        workspaceId,
        videoId,
        sourceTrackId: track.id,
        revisionKind: "raw_caption_import",
        revisionNumber: 1,
        languageCode: "en",
        segmentCount: segments.length,
        wordCount: segments.reduce(
          (acc, s) => acc + s.text.split(/\s+/).length,
          0
        ),
        createdByUserId: userId,
      })
      .returning();

    // Store raw segments
    if (segments.length > 0) {
      await db.insert(transcriptSegments).values(
        segments.map((seg, i) => ({
          revisionId: rawRevision.id,
          seq: i,
          startMs: Math.round(seg.start * 1000),
          endMs: Math.round(seg.end * 1000),
          text: seg.text,
        }))
      );
    }

    // 4. Create normalized (paragraph-merged) revision
    const filtered = filterNoise(segments);
    const paragraphs = mergeIntoParagraphs(filtered);

    const [normalizedRevision] = await db
      .insert(transcriptRevisions)
      .values({
        workspaceId,
        videoId,
        basedOnRevisionId: rawRevision.id,
        revisionKind: "normalized",
        revisionNumber: 2,
        languageCode: "en",
        segmentCount: paragraphs.length,
        wordCount: paragraphs.reduce(
          (acc, p) => acc + p.text.split(/\s+/).length,
          0
        ),
        createdByUserId: userId,
      })
      .returning();

    if (paragraphs.length > 0) {
      await db.insert(transcriptSegments).values(
        paragraphs.map((p, i) => ({
          revisionId: normalizedRevision.id,
          seq: i,
          startMs: Math.round(p.timestamp * 1000),
          endMs:
            i + 1 < paragraphs.length
              ? Math.round(paragraphs[i + 1].timestamp * 1000)
              : Math.round(p.timestamp * 1000) + 30000,
          text: p.text,
        }))
      );
    }

    // 5. Create cleaned (no-AI) revision
    const cleanedParagraphs = noAiCleanup(segments);

    const [cleanedRevision] = await db
      .insert(transcriptRevisions)
      .values({
        workspaceId,
        videoId,
        basedOnRevisionId: normalizedRevision.id,
        revisionKind: "cleaned",
        revisionNumber: 3,
        languageCode: "en",
        segmentCount: cleanedParagraphs.length,
        wordCount: cleanedParagraphs.reduce(
          (acc, p) => acc + p.text.split(/\s+/).length,
          0
        ),
        createdByUserId: userId,
      })
      .returning();

    if (cleanedParagraphs.length > 0) {
      await db.insert(transcriptSegments).values(
        cleanedParagraphs.map((p, i) => ({
          revisionId: cleanedRevision.id,
          seq: i,
          startMs: Math.round(p.timestamp * 1000),
          endMs:
            i + 1 < cleanedParagraphs.length
              ? Math.round(cleanedParagraphs[i + 1].timestamp * 1000)
              : Math.round(p.timestamp * 1000) + 30000,
          text: p.text,
        }))
      );
    }

    // 6. Update video status
    await db
      .update(sourceVideos)
      .set({
        ingestStatus: "captions_available",
        lastCaptionsCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sourceVideos.id, videoId));

    // 7. Mark run succeeded
    await db
      .update(appRuns)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        outputJson: {
          rawSegments: segments.length,
          normalizedParagraphs: paragraphs.length,
          cleanedParagraphs: cleanedParagraphs.length,
          revisionIds: [rawRevision.id, normalizedRevision.id, cleanedRevision.id],
        },
      })
      .where(eq(appRuns.id, runId));

    console.log(
      `[video-ingest] Completed ${providerVideoId}: ${segments.length} segments -> ${cleanedParagraphs.length} paragraphs`
    );
  } catch (error) {
    console.error(`[video-ingest] Failed ${providerVideoId}:`, error);

    // Mark video as failed
    await db
      .update(sourceVideos)
      .set({
        ingestStatus: "ingest_failed",
        lastCaptionsCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sourceVideos.id, videoId));

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
