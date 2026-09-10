/**
 * Transcribe the videos a workspace has imported but never ingested.
 *
 * Complements ingest-channel.ts, which walks one channel's uploads: this works
 * from the library itself, so it picks up every video with no transcript no
 * matter which channel it came from.
 *
 * Free by default — YouTube's own caption track when there is one, local
 * whisper.cpp when there is not, and a no-AI cleanup pass. Nothing here calls a
 * paid API unless you pass --api.
 *
 *   bun run scripts/ingest-missing.ts                  # list what would run
 *   bun run scripts/ingest-missing.ts --apply          # transcribe them
 *   bun run scripts/ingest-missing.ts --apply --limit 3
 *   bun run scripts/ingest-missing.ts --apply --min-duration 300
 *   bun run scripts/ingest-missing.ts --apply --ids abc123,def456
 */
import { db } from "@/server/db";
import {
  workspaces,
  users,
  sourceVideos,
  workspaceVideos,
  appRuns,
} from "@/server/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { handleVideoIngest } from "@/server/jobs/handlers/video-ingest";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const APPLY = process.argv.includes("--apply");
const USE_API = process.argv.includes("--api");
const WORKSPACE_SLUG = arg("workspace", "st-johns")!;
const LIMIT = Number(arg("limit", "1000"));
const MIN_DURATION = Number(arg("min-duration", "0"));
/** Comma-separated YouTube ids, when you want an exact set rather than a sweep. */
const ONLY_IDS = (arg("ids") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, WORKSPACE_SLUG))
    .limit(1);
  if (!workspace) throw new Error(`No workspace "${WORKSPACE_SLUG}"`);

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, workspace.createdByUserId))
    .limit(1);
  if (!user) throw new Error("Workspace owner not found");

  const missing = await db
    .select({
      id: workspaceVideos.videoId,
      title: sourceVideos.title,
      status: workspaceVideos.ingestStatus,
      duration: sourceVideos.durationSeconds,
    })
    .from(workspaceVideos)
    .innerJoin(sourceVideos, eq(sourceVideos.id, workspaceVideos.videoId))
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspace.id),
        sql`not exists (
          select 1 from transcript_revision tr
          where tr.video_id = ${workspaceVideos.videoId}
            and tr.workspace_id = ${workspaceVideos.workspaceId}
            and tr.segment_count > 0
        )`
      )
    )
    .orderBy(desc(sourceVideos.publishedAt));

  const queue = missing
    .filter((v) => (ONLY_IDS.length ? ONLY_IDS.includes(v.id) : true))
    .filter((v) => (v.duration ?? 0) >= MIN_DURATION)
    .slice(0, LIMIT);

  console.log(
    `${missing.length} video(s) in "${WORKSPACE_SLUG}" have no transcript; ` +
      `${queue.length} queued (min duration ${MIN_DURATION}s, limit ${LIMIT})\n`
  );
  for (const v of queue) {
    const mins = v.duration ? `${Math.round(v.duration / 60)}m` : "?";
    console.log(`  ${v.status.padEnd(17)} ${mins.padStart(5)}  ${v.title.slice(0, 56)}`);
  }

  if (!APPLY) {
    console.log(`\nRe-run with --apply to transcribe these.`);
    process.exit(0);
  }

  console.log(
    `\nTranscribing with ${USE_API ? "the Whisper API (paid)" : "local whisper.cpp (free)"}...\n`
  );

  let ok = 0;
  const failures: { title: string; error: string }[] = [];

  for (const [i, v] of queue.entries()) {
    const label = `[${i + 1}/${queue.length}] ${v.title.slice(0, 56)}`;
    const started = Date.now();
    const [run] = await db
      .insert(appRuns)
      .values({
        workspaceId: workspace.id,
        kind: "video_ingest",
        status: "queued",
        subjectType: "video",
        subjectId: v.id,
        triggeredByUserId: user.id,
        inputJson: { videoId: v.id },
      })
      .returning();

    try {
      await handleVideoIngest({
        workspaceId: workspace.id,
        videoId: v.id,
        userId: user.id,
        runId: run.id,
        allowWhisperFallback: USE_API,
        useLocalWhisper: !USE_API,
      });
      ok++;
      console.log(`  ✓ ${label}  (${Math.round((Date.now() - started) / 1000)}s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ title: v.title, error: message });
      await db
        .update(appRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          errorMessage: message.slice(0, 500),
        })
        .where(eq(appRuns.id, run.id));
      await db
        .update(workspaceVideos)
        .set({ ingestStatus: "captions_missing" })
        .where(
          and(
            eq(workspaceVideos.workspaceId, workspace.id),
            eq(workspaceVideos.videoId, v.id)
          )
        );
      console.log(`  ✗ ${label}\n      ${message.slice(0, 160)}`);
    }
  }

  console.log(`\nDone: ${ok} ingested, ${failures.length} failed.`);
  for (const f of failures) console.log(`  - ${f.title.slice(0, 50)}: ${f.error.slice(0, 110)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
