/**
 * Remove transcripts that carry no usable speech.
 *
 * Whisper responds to silent or music-only audio by repeating a filler
 * phrase ("you", "Thank you.") for the length of the file. The cleanup pass
 * correctly discards all of it, which leaves a video marked as successfully
 * ingested but with an empty "cleaned" revision — a state that only surfaces
 * later, as a confusing failure at draft time.
 *
 * This finds those videos, deletes their revisions, and puts them back to
 * captions_missing so they are visible as needing attention.
 *
 *   bun run scripts/prune-empty-transcripts.ts            # report only
 *   bun run scripts/prune-empty-transcripts.ts --apply    # actually delete
 */
import { db } from "@/server/db";
import {
  workspaces,
  sourceVideos,
  workspaceVideos,
  transcriptRevisions,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const APPLY = process.argv.includes("--apply");
const WORKSPACE_SLUG = arg("workspace", "st-johns")!;

async function main() {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, WORKSPACE_SLUG))
    .limit(1);
  if (!workspace) throw new Error(`No workspace "${WORKSPACE_SLUG}"`);

  const empty = await db
    .select({
      videoId: transcriptRevisions.videoId,
      title: sourceVideos.title,
    })
    .from(transcriptRevisions)
    .innerJoin(sourceVideos, eq(sourceVideos.id, transcriptRevisions.videoId))
    .where(
      and(
        eq(transcriptRevisions.workspaceId, workspace.id),
        eq(transcriptRevisions.revisionKind, "cleaned"),
        eq(transcriptRevisions.segmentCount, 0)
      )
    );

  if (empty.length === 0) {
    console.log("No empty transcripts found.");
    process.exit(0);
  }

  console.log(`${empty.length} video(s) with an empty cleaned transcript:\n`);
  for (const v of empty) console.log(`  ${v.videoId}  ${v.title.slice(0, 60)}`);

  if (!APPLY) {
    console.log(`\nRe-run with --apply to delete these and mark them captions_missing.`);
    process.exit(0);
  }

  for (const v of empty) {
    // transcript_segment rows cascade from transcript_revision.
    await db
      .delete(transcriptRevisions)
      .where(
        and(
          eq(transcriptRevisions.workspaceId, workspace.id),
          eq(transcriptRevisions.videoId, v.videoId)
        )
      );
    await db
      .update(workspaceVideos)
      .set({ ingestStatus: "captions_missing" })
      .where(
        and(
          eq(workspaceVideos.workspaceId, workspace.id),
          eq(workspaceVideos.videoId, v.videoId)
        )
      );
  }

  console.log(`\nPruned ${empty.length} video(s); marked captions_missing.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
