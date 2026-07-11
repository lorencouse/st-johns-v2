import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { workspaceVideos, appRuns } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { draftGenerateQueue } from "@/server/jobs/queue";
import { findActiveRun } from "@/server/jobs/runs";

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

  // Verify video belongs to workspace via junction table
  const [wsVideo] = await db
    .select()
    .from(workspaceVideos)
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspaceId),
        eq(workspaceVideos.videoId, videoId)
      )
    )
    .limit(1);

  if (!wsVideo) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Attach to an in-flight generation instead of enqueueing a duplicate
  const activeRun = await findActiveRun(
    workspaceId,
    "project_generate",
    videoId
  );
  if (activeRun) {
    return NextResponse.json({ runId: activeRun.id }, { status: 202 });
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
