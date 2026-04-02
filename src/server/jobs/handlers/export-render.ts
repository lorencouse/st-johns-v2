import { db } from "@/server/db";
import {
  exportArtifacts,
  draftVersions,
  contentProjects,
  sourceVideos,
  appRuns,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { renderHtml, renderMarkdown } from "@/server/export/render";
import type { Paragraph } from "@/server/ai/cleanup";

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
      .where(eq(draftVersions.id, draftVersionId))
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
      .where(eq(contentProjects.id, projectId))
      .limit(1);

    if (!project) throw new Error("Project not found");

    // 3. Extract paragraphs from content JSON
    const contentDoc = draft.contentJson as {
      type: string;
      content: Array<{
        type: string;
        attrs?: { timestamp?: number };
        content?: Array<{ type: string; text: string }>;
      }>;
    };

    const paragraphs: Paragraph[] = (contentDoc.content || [])
      .filter((node) => node.type === "paragraph" && node.content?.length)
      .map((node) => ({
        timestamp: node.attrs?.timestamp ?? 0,
        text: (node.content || []).map((c) => c.text).join(""),
      }));

    // 4. Render
    let bodyText: string;
    let mimeType: string;
    let extension: string;

    if (format === "html") {
      bodyText = renderHtml(project.videoId, paragraphs, {
        intro: draft.intro,
        summary: draft.summary,
      });
      mimeType = "text/html";
      extension = "html";
    } else {
      bodyText = renderMarkdown(project.videoId, paragraphs, {
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
    console.error(`[export-render] Failed:`, error);

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
