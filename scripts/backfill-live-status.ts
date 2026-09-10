/**
 * Fill in live_status / scheduled_start_at for videos synced before those
 * columns existed.
 *
 * A scheduled premiere has no audio, so the library used to show it as an
 * ordinary unprocessed video with a "Fetch captions" button that could never
 * succeed. Channel sync records the state going forward; this catches up rows
 * that predate it.
 *
 * Uses the public Data API key (1 unit per 50 videos), not OAuth, so it works
 * for channels the account does not own.
 *
 *   bun run scripts/backfill-live-status.ts             # report only
 *   bun run scripts/backfill-live-status.ts --apply
 *   bun run scripts/backfill-live-status.ts --apply --all   # recheck every video
 */
import { db } from "@/server/db";
import { sourceVideos } from "@/server/db/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { fetchVideoDetails } from "@/server/youtube/api";

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");

  const rows = await db
    .select({ id: sourceVideos.id, title: sourceVideos.title })
    .from(sourceVideos)
    .where(ALL ? sql`true` : isNull(sourceVideos.liveStatus));

  if (rows.length === 0) {
    console.log("Nothing to backfill.");
    process.exit(0);
  }
  console.log(`Checking ${rows.length} video(s) against the YouTube Data API...`);

  const details = await fetchVideoDetails(
    rows.map((r) => r.id),
    { apiKey }
  );

  const titles = new Map(rows.map((r) => [r.id, r.title]));
  const scheduled: string[] = [];
  let written = 0;

  for (const [id, d] of details) {
    if (d.liveStatus && d.liveStatus !== "none") {
      const when = d.scheduledStartAt
        ? new Date(d.scheduledStartAt).toLocaleString()
        : "no start time";
      scheduled.push(`  ${d.liveStatus.padEnd(9)} ${when.padEnd(22)} ${(titles.get(id) ?? "").slice(0, 44)}`);
    }
    if (!APPLY) continue;
    await db
      .update(sourceVideos)
      .set({
        liveStatus: d.liveStatus ?? "none",
        scheduledStartAt: d.scheduledStartAt ? new Date(d.scheduledStartAt) : null,
      })
      .where(eq(sourceVideos.id, id));
    written++;
  }

  const missing = rows.length - details.size;
  console.log(
    `\n${details.size} answered by the API` +
      (missing > 0 ? `, ${missing} not returned (deleted or private)` : "")
  );
  console.log(`${scheduled.length} upcoming or live:`);
  for (const line of scheduled) console.log(line);

  if (!APPLY) {
    console.log(`\nRe-run with --apply to write these.`);
  } else {
    console.log(`\nWrote live status for ${written} video(s).`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
