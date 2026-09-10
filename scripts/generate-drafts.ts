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
 *   --video <id>        Only this YouTube video id
 *   --out <dir>         Also write each export to disk
 *   --redo              Regenerate even if a draft exists
 *
 * Note: this calls the OpenAI API, so it costs money — roughly a cent or
 * two per service with gpt-4o-mini. Start with a small --limit.
 */
import { db } from "@/server/db";
import {
  workspaces,
  workspaceMembers,
  sourceVideos,
  workspaceVideos,
  transcriptRevisions,
  contentProjects,
  draftVersions,
  exportArtifacts,
  appRuns,
} from "@/server/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { handleDraftGenerate } from "@/server/jobs/handlers/draft-generate";
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
const ONLY_VIDEO = arg("video");
const OUT_DIR = arg("out");

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

  if (ONLY_VIDEO) videoIds = videoIds.filter((id) => id === ONLY_VIDEO);

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

  const queue = videoIds.slice(0, LIMIT);
  console.log(`\n${videoIds.length} videos awaiting a draft; generating ${queue.length}\n`);
  if (OUT_DIR) await mkdir(OUT_DIR, { recursive: true });

  let ok = 0;
  const failures: string[] = [];

  for (const [i, videoId] of queue.entries()) {
    const [video] = await db
      .select({ title: sourceVideos.title })
      .from(sourceVideos)
      .where(eq(sourceVideos.id, videoId))
      .limit(1);
    const label = `[${i + 1}/${queue.length}] ${video?.title.slice(0, 58) ?? videoId}`;

    try {
      // --- Draft (AI cleanup + summary) ---
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

      ok++;
      console.log(`  ✓ ${label}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${video?.title ?? videoId}: ${message}`);
      console.log(`  ✗ ${label}\n      ${message.slice(0, 160)}`);
    }
  }

  console.log(`\nDone: ${ok} posts generated, ${failures.length} failed.`);
  for (const f of failures) console.log(`  - ${f.slice(0, 140)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
