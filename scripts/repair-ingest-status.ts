/**
 * Re-sync workspace_video.ingest_status with the transcripts that exist.
 *
 * Videos transcribed outside the ingest handler — or whose status write missed
 * the junction row — keep an old flag like "discovered" or "captions_missing".
 * The library then shows them as "Not processed" with a "Fetch captions"
 * button even though the transcript (and often a project) is already there.
 *
 * This finds every video that holds a transcript with content and puts its
 * flag back to captions_available.
 *
 *   bun run scripts/repair-ingest-status.ts                     # report only
 *   bun run scripts/repair-ingest-status.ts --apply             # fix them
 *   bun run scripts/repair-ingest-status.ts --workspace my-slug
 */
import { db } from "@/server/db";
import {
  workspaces,
  sourceVideos,
  workspaceVideos,
  transcriptRevisions,
} from "@/server/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

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

  const stale = await db
    .selectDistinct({
      videoId: workspaceVideos.videoId,
      status: workspaceVideos.ingestStatus,
      title: sourceVideos.title,
      segments: sql<number>`sum(${transcriptRevisions.segmentCount})::int`,
    })
    .from(workspaceVideos)
    .innerJoin(sourceVideos, eq(sourceVideos.id, workspaceVideos.videoId))
    .innerJoin(
      transcriptRevisions,
      and(
        eq(transcriptRevisions.videoId, workspaceVideos.videoId),
        eq(transcriptRevisions.workspaceId, workspaceVideos.workspaceId)
      )
    )
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspace.id),
        ne(workspaceVideos.ingestStatus, "captions_available")
      )
    )
    .groupBy(
      workspaceVideos.videoId,
      workspaceVideos.ingestStatus,
      sourceVideos.title
    )
    .having(sql`sum(${transcriptRevisions.segmentCount}) > 0`);

  if (stale.length === 0) {
    console.log("Every transcribed video already reads captions_available.");
    process.exit(0);
  }

  console.log(
    `${stale.length} video(s) have a transcript but a stale ingest status:\n`
  );
  for (const v of stale) {
    console.log(
      `  ${v.videoId}  ${v.status.padEnd(17)} ${String(v.segments).padStart(5)} segs  ${v.title.slice(0, 50)}`
    );
  }

  if (!APPLY) {
    console.log(`\nRe-run with --apply to mark these captions_available.`);
    process.exit(0);
  }

  for (const v of stale) {
    await db
      .update(workspaceVideos)
      .set({ ingestStatus: "captions_available" })
      .where(
        and(
          eq(workspaceVideos.workspaceId, workspace.id),
          eq(workspaceVideos.videoId, v.videoId)
        )
      );
  }

  console.log(`\nRepaired ${stale.length} video(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
