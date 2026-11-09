import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceRole } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { findWorkspaceVideo } from "@/server/services/queries";
import {
  latestRevisionNumber,
  saveTranscriptRevision,
} from "@/server/transcripts/revisions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; videoId: string }> }
) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceRole(workspaceId, "edit");
  if ("error" in ctx) return ctx.error;

  if (!(await findWorkspaceVideo(workspaceId, videoId))) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const body = await req.json();
  const segments: Array<{
    seq: number;
    startMs: number;
    endMs: number;
    text: string;
  }> = body.segments;

  if (!Array.isArray(segments) || segments.length === 0) {
    return NextResponse.json(
      { error: "No segments provided" },
      { status: 400 }
    );
  }

  // A revision and its segments land together, so a failure cannot leave an
  // empty human_edited revision for the writer to prefer.
  const revision = await db.transaction(async (tx) =>
    saveTranscriptRevision(tx, {
      workspaceId,
      videoId,
      revisionKind: "human_edited",
      revisionNumber: (await latestRevisionNumber(tx, workspaceId, videoId)) + 1,
      createdByUserId: ctx.userId,
      segments: segments.map(({ startMs, endMs, text }) => ({ startMs, endMs, text })),
    })
  );

  return NextResponse.json({
    revisionId: revision.id,
    segmentCount: segments.length,
  });
}
