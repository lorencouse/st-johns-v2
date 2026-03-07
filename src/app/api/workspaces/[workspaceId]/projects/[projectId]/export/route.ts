import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { contentProjects, appRuns } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { exportRenderQueue } from "@/server/jobs/queue";

export async function POST(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
  const { workspaceId, projectId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const body = await req.json();
  const format = body.format === "markdown" ? "markdown" : "html";

  const [project] = await db
    .select()
    .from(contentProjects)
    .where(
      and(
        eq(contentProjects.id, projectId),
        eq(contentProjects.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.activeDraftVersionId) {
    return NextResponse.json(
      { error: "No active draft to export" },
      { status: 400 }
    );
  }

  const [run] = await db
    .insert(appRuns)
    .values({
      workspaceId,
      kind: "export_render",
      status: "queued",
      subjectType: "content_project",
      subjectId: projectId,
      triggeredByUserId: ctx.userId,
      inputJson: { format },
    })
    .returning();

  await exportRenderQueue.add("export", {
    workspaceId,
    projectId,
    draftVersionId: project.activeDraftVersionId,
    format,
    userId: ctx.userId,
    runId: run.id,
  });

  return NextResponse.json({ runId: run.id }, { status: 202 });
}
