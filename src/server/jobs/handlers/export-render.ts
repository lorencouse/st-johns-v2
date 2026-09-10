import { db } from "@/server/db";
import {
  exportArtifacts,
  draftVersions,
  contentProjects,
  sourceVideos,
  appRuns,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { renderHtml, renderMarkdown } from "@/server/export/render";
import { blocksFromContentJson } from "@/server/content/document";

export interface ExportRenderPayload {
  workspaceId: string;
  projectId: string;
  draftVersionId: string;
  format: "html" | "markdown";
  userId: string;
  runId: string;
}

export async function handleExportRender(payload: ExportRenderPayload) {
  const { workspaceId, projectId, draftVersionId, format, userId, runId } =
    payload;

  await db
    .update(appRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(appRuns.id, runId));

  try {
    // 1. Load draft version
    const [draft] = await db
      .select()
      .from(draftVersions)
      .where(
        and(
          eq(draftVersions.id, draftVersionId),
          eq(draftVersions.workspaceId, workspaceId),
          eq(draftVersions.contentProjectId, projectId)
        )
      )
      .limit(1);

    if (!draft) throw new Error("Draft version not found");

    // 2. Load project + video for metadata
    const [project] = await db
      .select({
        project: contentProjects,
        videoId: sourceVideos.id,
        videoTitle: sourceVideos.title,
      })
      .from(contentProjects)
      .innerJoin(
        sourceVideos,
        eq(sourceVideos.id, contentProjects.sourceVideoId)
      )
      .where(
        and(
          eq(contentProjects.id, projectId),
          eq(contentProjects.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!project) throw new Error("Project not found");

    // 3. Extract the body from content JSON, headings included
    const blocks = blocksFromContentJson(draft.contentJson);

    // 4. Render
    let bodyText: string;
    let mimeType: string;
    let extension: string;

    if (format === "html") {
      bodyText = renderHtml(project.videoId, blocks, {
        intro: draft.intro,
        summary: draft.summary,
      });
      mimeType = "text/html";
      extension = "html";
    } else {
      bodyText = renderMarkdown(project.videoId, blocks, {
        intro: draft.intro,
        summary: draft.summary,
        title: draft.title,
      });
      mimeType = "text/markdown";
      extension = "md";
    }

    const fileName = `${draft.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}.${extension}`;

    // 5. Store export artifact
    const [artifact] = await db
      .insert(exportArtifacts)
      .values({
        workspaceId,
        contentProjectId: projectId,
        sourceDraftVersionId: draftVersionId,
        format,
        fileName,
        mimeType,
        bodyText,
        createdByUserId: userId,
      })
      .returning();

    // 6. Mark run succeeded
    await db
      .update(appRuns)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        outputJson: {
          exportArtifactId: artifact.id,
          format,
          fileName,
          bodyLength: bodyText.length,
        },
      })
      .where(eq(appRuns.id, runId));

    console.log(`[export-render] Created ${format} export: ${fileName}`);
  } catch (error) {
    // Failure state is written by the worker's final-failure handler.
    console.error(`[export-render] Failed:`, error);
    throw error;
  }
}
