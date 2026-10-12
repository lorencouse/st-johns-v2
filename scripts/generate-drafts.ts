/**
 * Turn ingested transcripts into finished blog posts.
 *
 * For each video that has a transcript but no draft yet, runs the AI cleanup
 * and summary pass, then renders an HTML export in the shape the post needs:
 * AI summary, then the embedded video, then the transcript.
 *
 *   bun run scripts/generate-drafts.ts --limit 5
 *
 * Flags:
 *   --workspace <slug>  Workspace to work in            (default: st-johns)
 *   --limit <n>         Max posts to generate this run  (default: 5)
 *   --video <ids>       Only these YouTube video ids (comma-separated)
 *   --out <dir>         Also write each export to disk
 *   --redo              Regenerate even if a draft exists. Keeps any post
 *                       that is under review, approved, or edited in the
 *                       studio (see src/server/content/redo-guard.ts)
 *   --force             With --redo, replace those protected posts too
 *   --concurrency <n>   Posts to generate at once        (default: 4)
 *   --skip-structured   Skip videos whose draft already has section headings,
 *                       so an interrupted batch resumes without paying twice
 *   --skip-redone-minutes <n>
 *                       Skip videos whose draft was rewritten in the last n
 *                       minutes, so an interrupted --redo batch resumes
 *
 * Note: this calls the OpenAI API, so it costs money — roughly a cent or
 * two per service with gpt-4o-mini. Start with a small --limit.
 */
import { db } from "@/server/db";
import {
  workspaces,
  workspaceMembers,
  sourceVideos,
  transcriptRevisions,
  contentProjects,
  draftVersions,
  exportArtifacts,
  appRuns,
} from "@/server/db/schema";
import { and, eq, gt, inArray, desc, sql } from "drizzle-orm";
import {
  handleDraftGenerate,
  DraftProtectedError,
} from "@/server/jobs/handlers/draft-generate";
import { redoBlockReason } from "@/server/content/redo-guard";
import { handleExportRender } from "@/server/jobs/handlers/export-render";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const WORKSPACE_SLUG = arg("workspace", "st-johns")!;
const LIMIT = parseInt(arg("limit", "5")!, 10);
const ONLY_VIDEOS = arg("video")?.split(",").map((id) => id.trim()).filter(Boolean);
const FORCE = flag("force");
const OUT_DIR = arg("out");
const CONCURRENCY = Math.max(1, parseInt(arg("concurrency", "4")!, 10));
const SKIP_REDONE_MINUTES = parseInt(arg("skip-redone-minutes", "0")!, 10);

async function main() {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, WORKSPACE_SLUG))
    .limit(1);
  if (!workspace) throw new Error(`No workspace "${WORKSPACE_SLUG}". Run ingest-channel first.`);

  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspace.id),
        eq(workspaceMembers.role, "owner")
      )
    )
    .limit(1);
  if (!member) throw new Error("Workspace has no owner");
  const userId = member.userId;

  // Videos that have a transcript to work from.
  const transcribed = await db
    .selectDistinct({ videoId: transcriptRevisions.videoId })
    .from(transcriptRevisions)
    .where(eq(transcriptRevisions.workspaceId, workspace.id));
  let videoIds = transcribed.map((r) => r.videoId);

  if (ONLY_VIDEOS) videoIds = videoIds.filter((id) => ONLY_VIDEOS.includes(id));

  // Skip ones that already have a draft, unless --redo.
  if (!flag("redo") && videoIds.length) {
    const done = await db
      .select({ videoId: contentProjects.sourceVideoId })
      .from(contentProjects)
      .innerJoin(
        draftVersions,
        eq(draftVersions.contentProjectId, contentProjects.id)
      )
      .where(
        and(
          eq(contentProjects.workspaceId, workspace.id),
          inArray(contentProjects.sourceVideoId, videoIds)
        )
      );
    const skip = new Set(done.map((d) => d.videoId));
    videoIds = videoIds.filter((id) => !skip.has(id));
  }

  // A redo must not replace a post someone has reviewed or edited, unless
  // --force. The handler rechecks under lock; this just avoids the AI spend.
  if (flag("redo") && !FORCE && videoIds.length) {
    const existing = await db
      .select({ project: contentProjects, draft: draftVersions })
      .from(contentProjects)
      .leftJoin(
        draftVersions,
        eq(draftVersions.id, contentProjects.activeDraftVersionId)
      )
      .where(
        and(
          eq(contentProjects.workspaceId, workspace.id),
          inArray(contentProjects.sourceVideoId, videoIds)
        )
      );
    const protectedIds = new Map<string, string>();
    for (const { project, draft } of existing) {
      const reason = redoBlockReason(project, draft);
      if (reason) protectedIds.set(project.sourceVideoId, reason);
    }
    videoIds = videoIds.filter((id) => !protectedIds.has(id));
    if (protectedIds.size) {
      console.log(
        `Keeping ${protectedIds.size} reviewed or edited draft(s); pass --force to replace them:`
      );
      for (const [id, reason] of protectedIds) console.log(`  - ${id}: ${reason}`);
    }
  }

  // Resume support: a draft carrying heading nodes came from the structure
  // pass, so there is nothing to regenerate for it.
  if (flag("skip-structured") && videoIds.length) {
    const structured = await db
      .select({ videoId: contentProjects.sourceVideoId })
      .from(contentProjects)
      .innerJoin(
        draftVersions,
        eq(draftVersions.id, contentProjects.activeDraftVersionId)
      )
      .where(
        and(
          eq(contentProjects.workspaceId, workspace.id),
          sql`${draftVersions.contentJson} -> 'content' @> '[{"type":"heading"}]'`
        )
      );
    const skip = new Set(structured.map((r) => r.videoId));
    videoIds = videoIds.filter((id) => !skip.has(id));
    if (skip.size) console.log(`Skipping ${skip.size} already-structured draft(s)`);
  }

  // Resume support for --redo: a draft written in the last N minutes came from
  // this same batch, so re-running it would pay for identical work. Time-based
  // rather than shape-based, because a --redo batch regenerates drafts that
  // already have headings and so are indistinguishable from unfinished ones.
  if (SKIP_REDONE_MINUTES > 0 && videoIds.length) {
    const cutoff = new Date(Date.now() - SKIP_REDONE_MINUTES * 60_000);
    const fresh = await db
      .select({ videoId: contentProjects.sourceVideoId })
      .from(contentProjects)
      .innerJoin(
        draftVersions,
        eq(draftVersions.contentProjectId, contentProjects.id)
      )
      .where(
        and(
          eq(contentProjects.workspaceId, workspace.id),
          gt(draftVersions.createdAt, cutoff)
        )
      );
    const skip = new Set(fresh.map((r) => r.videoId));
    videoIds = videoIds.filter((id) => !skip.has(id));
    if (skip.size)
      console.log(
        `Skipping ${skip.size} draft(s) regenerated in the last ${SKIP_REDONE_MINUTES} min`
      );
  }

  const queue = videoIds.slice(0, LIMIT);
  console.log(
    `\n${videoIds.length} videos awaiting a draft; generating ${queue.length}` +
      (CONCURRENCY > 1 ? ` — ${CONCURRENCY} at a time\n` : `\n`)
  );
  if (OUT_DIR) await mkdir(OUT_DIR, { recursive: true });

  const titles = new Map<string, string>();
  if (queue.length) {
    const rows = await db
      .select({ id: sourceVideos.id, title: sourceVideos.title })
      .from(sourceVideos)
      .where(inArray(sourceVideos.id, queue));
    for (const row of rows) titles.set(row.id, row.title);
  }

  async function generateOne(videoId: string) {
    // --- Draft (AI cleanup + structure + summary) ---
    const [draftRun] = await db
      .insert(appRuns)
      .values({
        workspaceId: workspace.id,
        kind: "project_generate",
        status: "queued",
        subjectType: "video",
        subjectId: videoId,
        triggeredByUserId: userId,
        inputJson: { videoId },
      })
      .returning();

    await handleDraftGenerate({
      workspaceId: workspace.id,
      videoId,
      userId,
      runId: draftRun.id,
      keepEditedDrafts: !FORCE,
    });

    // --- Locate what the draft run produced ---
    const [project] = await db
      .select()
      .from(contentProjects)
      .where(
        and(
          eq(contentProjects.workspaceId, workspace.id),
          eq(contentProjects.sourceVideoId, videoId)
        )
      )
      .limit(1);
    if (!project?.activeDraftVersionId) throw new Error("Draft was not created");

    // --- Export (summary -> embed -> transcript) ---
    const [exportRun] = await db
      .insert(appRuns)
      .values({
        workspaceId: workspace.id,
        kind: "export_render",
        status: "queued",
        subjectType: "draft_version",
        subjectId: project.activeDraftVersionId,
        triggeredByUserId: userId,
        inputJson: { format: "html" },
      })
      .returning();

    await handleExportRender({
      workspaceId: workspace.id,
      projectId: project.id,
      draftVersionId: project.activeDraftVersionId,
      format: "html",
      userId,
      runId: exportRun.id,
    });

    if (OUT_DIR) {
      const [artifact] = await db
        .select()
        .from(exportArtifacts)
        .where(
          eq(exportArtifacts.sourceDraftVersionId, project.activeDraftVersionId)
        )
        .orderBy(desc(exportArtifacts.createdAt))
        .limit(1);
      if (artifact?.bodyText) {
        await writeFile(join(OUT_DIR, artifact.fileName), artifact.bodyText, "utf8");
      }
    }
  }

  let ok = 0;
  let finished = 0;
  const failures: string[] = [];
  const kept: string[] = [];
  const startedAt = Date.now();

  // Workers pull the next video as they free up, so one 90-minute service does
  // not hold up everything queued behind it.
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const videoId = queue[cursor++];
      const label = (titles.get(videoId) ?? videoId).slice(0, 52);
      try {
        await generateOne(videoId);
        ok++;
        console.log(`  \u2713 [${++finished}/${queue.length}] ${label}`);
      } catch (err) {
        if (err instanceof DraftProtectedError) {
          kept.push(`${label}: ${err.message}`);
          console.log(`  - [${++finished}/${queue.length}] ${label}\n      ${err.message}`);
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        failures.push(`${label}: ${message}`);
        console.log(
          `  \u2717 [${++finished}/${queue.length}] ${label}\n      ${message.slice(0, 160)}`
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker())
  );

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `\nDone in ${mins} min: ${ok} posts generated, ${failures.length} failed` +
      (kept.length ? `, ${kept.length} kept.` : ".")
  );
  for (const f of failures) console.log(`  - ${f.slice(0, 140)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
