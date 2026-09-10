import { sql } from "drizzle-orm";
import { transcriptRevisions, workspaceVideos } from "./schema";

/**
 * True when the workspace actually holds a transcript with content for this
 * video, regardless of what `workspace_video.ingest_status` claims.
 *
 * The flag and the transcripts can drift apart — a transcript imported outside
 * the ingest handler, or an ingest whose status write missed the junction row,
 * leaves a fully transcribed video looking unprocessed. Anything that asks
 * "does this video have captions?" should ask the transcripts, not the flag.
 *
 * Only valid in a query that has `workspace_video` in scope.
 */
export const hasTranscriptSql = sql<boolean>`exists (
  select 1
  from ${transcriptRevisions} tr
  where tr.workspace_id = ${workspaceVideos.workspaceId}
    and tr.video_id = ${workspaceVideos.videoId}
    and tr.segment_count > 0
)`;

/** Same question, for callers that already loaded the two ids. */
export const captionsReadySql = sql<boolean>`(
  ${workspaceVideos.ingestStatus} = 'captions_available' or ${hasTranscriptSql}
)`;
