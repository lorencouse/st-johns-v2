import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceRole } from "@/lib/api-helpers";
import { findWorkspaceVideo } from "@/server/services/queries";
import { videoIngestQueue } from "@/server/jobs/queue";
import { createRun, findActiveRun } from "@/server/jobs/runs";
import { can } from "@/lib/permissions";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; videoId: string }> }
) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceRole(workspaceId, "edit");
  if ("error" in ctx) return ctx.error;

  if (!(await findWorkspaceVideo(workspaceId, videoId))) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Attach to an in-flight ingest instead of enqueueing a duplicate
  const activeRun = await findActiveRun(workspaceId, "video_ingest", videoId);
  if (activeRun) {
    return NextResponse.json({ runId: activeRun.id }, { status: 202 });
  }

  const run = await createRun({
    workspaceId,
    kind: "video_ingest",
    subjectType: "source_video",
    subjectId: videoId,
    userId: ctx.userId,
  });

  // Queue job — Whisper fallback only for admins/owners
  const allowWhisperFallback = can(ctx.role, "admin");
  await videoIngestQueue.add("ingest", {
    workspaceId,
    videoId,
    userId: ctx.userId,
    runId: run.id,
    allowWhisperFallback,
  });

  return NextResponse.json({ runId: run.id }, { status: 202 });
}
