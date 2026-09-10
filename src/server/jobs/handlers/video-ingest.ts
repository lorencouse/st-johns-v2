import { db } from "@/server/db";
import {
  captionTracks,
  transcriptRevisions,
  transcriptSegments,
  workspaceVideos,
  appRuns,
} from "@/server/db/schema";
import { eq, and, max } from "drizzle-orm";
import { type CaptionSegment } from "@/server/youtube/api";
import {
  fetchPublicCaptions,
  type CaptionKind,
} from "@/server/youtube/public-captions";
import { transcribeWithWhisper } from "@/server/youtube/transcribe";
import { transcribeLocally } from "@/server/youtube/transcribe-local";
import {
  filterNoise,
  mergeIntoParagraphs,
  noAiCleanup,
} from "@/server/ai/cleanup";

export interface VideoIngestPayload {
  workspaceId: string;
  videoId: string; // YouTube video ID (e.g. "dQw4w9WgXcQ")
  userId: string;
  runId: string;
  allowWhisperFallback?: boolean;
  /** Transcribe with local whisper.cpp instead of the paid API. */
  useLocalWhisper?: boolean;
}

export async function handleVideoIngest(payload: VideoIngestPayload) {
  const { workspaceId, videoId, userId, runId } = payload;

  await db
    .update(appRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(appRuns.id, runId));

  try {
    // 1. Pull YouTube's own caption track via yt-dlp. This works for any
    //    public video, unlike the Data API's captions.download endpoint,
    //    which only serves channels the OAuth user owns.
    let fetchedSegments: CaptionSegment[] | undefined;
    let captionKind: CaptionKind | "unknown" = "unknown";
    let captionLanguage = "en";

    try {
      const result = await fetchPublicCaptions(videoId);
      fetchedSegments = result.segments;
      captionKind = result.kind;
      captionLanguage = result.languageCode;
    } catch (captionErr) {
      console.log(
        `[video-ingest] No YouTube captions for ${videoId}: ` +
          `${captionErr instanceof Error ? captionErr.message : captionErr}`
      );
    }

    // 2. Fall back to Whisper for videos with no caption track at all.
    //    Local whisper.cpp is preferred: it is free and unmetered, so the
    //    paid API is only used when explicitly asked for.
    if (!fetchedSegments || fetchedSegments.length === 0) {
      if (payload.useLocalWhisper) {
        console.log(`[video-ingest] Transcribing ${videoId} with local Whisper`);
        fetchedSegments = await transcribeLocally(videoId);
        captionKind = "asr";
      } else if (payload.allowWhisperFallback) {
        console.log(`[video-ingest] Transcribing ${videoId} with the Whisper API`);
        fetchedSegments = await transcribeWithWhisper(videoId);
        captionKind = "asr";
      } else {
        throw new Error(
          "No YouTube caption track for this video, and no Whisper fallback is enabled."
        );
      }
    }

    if (!fetchedSegments || fetchedSegments.length === 0) {
      throw new Error("Transcription produced no segments");
    }
    const segments: CaptionSegment[] = fetchedSegments;

    // 3. Derive the normalized/cleaned forms (pure CPU, no DB)
    const filtered = filterNoise(segments);
    const paragraphs = mergeIntoParagraphs(filtered);
    const cleanedParagraphs = noAiCleanup(segments);

    // 4. Persist everything atomically. Revision numbers continue from the
    // current max so re-ingesting a video (retry, refreshed captions) never
    // collides with the unique (workspace, video, revisionNumber) constraint
    // or with human_edited revisions created in between.
    await db.transaction(async (tx) => {
      let [track] = await tx
        .select()
        .from(captionTracks)
        .where(
          and(
            eq(captionTracks.videoId, videoId),
            eq(captionTracks.languageCode, "en")
          )
        )
        .limit(1);

      if (track) {
        await tx
          .update(captionTracks)
          .set({ kind: captionKind, lastFetchedAt: new Date() })
          .where(eq(captionTracks.id, track.id));
      } else {
        [track] = await tx
          .insert(captionTracks)
          .values({
            videoId,
            languageCode: captionLanguage,
            kind: captionKind,
            isDefault: true,
            lastFetchedAt: new Date(),
          })
          .returning();
      }

      const [{ maxRevision }] = await tx
        .select({ maxRevision: max(transcriptRevisions.revisionNumber) })
        .from(transcriptRevisions)
        .where(
          and(
            eq(transcriptRevisions.workspaceId, workspaceId),
            eq(transcriptRevisions.videoId, videoId)
          )
        );
      const base = maxRevision ?? 0;

      const [rawRevision] = await tx
        .insert(transcriptRevisions)
        .values({
          workspaceId,
          videoId,
          sourceTrackId: track.id,
          revisionKind: "raw_caption_import",
          revisionNumber: base + 1,
          languageCode: "en",
          segmentCount: segments.length,
          wordCount: segments.reduce(
            (acc, s) => acc + s.text.split(/\s+/).length,
            0
          ),
          createdByUserId: userId,
        })
        .returning();

      if (segments.length > 0) {
        await tx.insert(transcriptSegments).values(
          segments.map((seg, i) => ({
            revisionId: rawRevision.id,
            seq: i,
            startMs: Math.round(seg.start * 1000),
            endMs: Math.round(seg.end * 1000),
            text: seg.text,
          }))
        );
      }

      const [normalizedRevision] = await tx
        .insert(transcriptRevisions)
        .values({
          workspaceId,
          videoId,
          basedOnRevisionId: rawRevision.id,
          revisionKind: "normalized",
          revisionNumber: base + 2,
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
        await tx.insert(transcriptSegments).values(
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

      const [cleanedRevision] = await tx
        .insert(transcriptRevisions)
        .values({
          workspaceId,
          videoId,
          basedOnRevisionId: normalizedRevision.id,
          revisionKind: "cleaned",
          revisionNumber: base + 3,
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
        await tx.insert(transcriptSegments).values(
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

      await tx
        .update(workspaceVideos)
        .set({
          ingestStatus: "captions_available",
          lastCaptionsCheckedAt: new Date(),
        })
        .where(
          and(
            eq(workspaceVideos.workspaceId, workspaceId),
            eq(workspaceVideos.videoId, videoId)
          )
        );

      await tx
        .update(appRuns)
        .set({
          status: "succeeded",
          finishedAt: new Date(),
          outputJson: {
            rawSegments: segments.length,
            normalizedParagraphs: paragraphs.length,
            cleanedParagraphs: cleanedParagraphs.length,
            revisionIds: [
              rawRevision.id,
              normalizedRevision.id,
              cleanedRevision.id,
            ],
          },
        })
        .where(eq(appRuns.id, runId));
    });

    console.log(
      `[video-ingest] Completed ${videoId}: ${segments.length} segments -> ${cleanedParagraphs.length} paragraphs`
    );
  } catch (error) {
    // Failure state (run + ingestStatus) is written by the worker's
    // final-failure handler so retries don't flicker the run to failed.
    console.error(`[video-ingest] Failed ${videoId}:`, error);
    throw error;
  }
}
