import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  sourceVideos,
  transcriptRevisions,
  transcriptSegments,
} from "@/server/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; videoId: string }> }
) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  if (!["owner", "admin", "editor"].includes(ctx.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  // Verify video belongs to workspace
  const [video] = await db
    .select()
    .from(sourceVideos)
    .where(
      and(
        eq(sourceVideos.id, videoId),
        eq(sourceVideos.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!video) {
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

  // Get next revision number
  const [latestRevision] = await db
    .select({ revisionNumber: transcriptRevisions.revisionNumber })
    .from(transcriptRevisions)
    .where(eq(transcriptRevisions.videoId, videoId))
    .orderBy(desc(transcriptRevisions.revisionNumber))
    .limit(1);

  const nextRevNumber = (latestRevision?.revisionNumber ?? 0) + 1;

  // Create human_edited revision
  const [revision] = await db
    .insert(transcriptRevisions)
    .values({
      workspaceId,
      videoId,
      revisionKind: "human_edited",
      revisionNumber: nextRevNumber,
      languageCode: "en",
      segmentCount: segments.length,
      wordCount: segments.reduce(
        (acc, s) => acc + s.text.split(/\s+/).length,
        0
      ),
      createdByUserId: ctx.userId,
    })
    .returning();

  // Store segments
  await db.insert(transcriptSegments).values(
    segments.map((s, i) => ({
      revisionId: revision.id,
      seq: i,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
    }))
  );

  return NextResponse.json({
    revisionId: revision.id,
    segmentCount: segments.length,
  });
}
