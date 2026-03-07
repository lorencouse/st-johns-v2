import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { sourceVideos, appRuns } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { draftGenerateQueue } from "@/server/jobs/queue";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; videoId: string }> }
) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  if (!["owner", "admin", "editor"].includes(ctx.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const [video] = await db
    .select()
    .from(sourceVideos)
    .where(
      and(eq(sourceVideos.id, videoId), eq(sourceVideos.workspaceId, workspaceId))
    )
    .limit(1);

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Create run
  const [run] = await db
    .insert(appRuns)
    .values({
      workspaceId,
      kind: "project_generate",
      status: "queued",
      subjectType: "source_video",
      subjectId: videoId,
      triggeredByUserId: ctx.userId,
    })
    .returning();

  // Queue job
  await draftGenerateQueue.add("generate", {
    workspaceId,
    videoId,
    userId: ctx.userId,
    runId: run.id,
  });

  return NextResponse.json({ runId: run.id }, { status: 202 });
}
