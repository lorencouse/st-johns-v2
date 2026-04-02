import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  transcriptIssues,
  transcriptRevisions,
  workspaceVideos,
  users,
} from "@/server/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; videoId: string }> }
) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const issues = await db
    .select({
      id: transcriptIssues.id,
      issueType: transcriptIssues.issueType,
      anchorStartMs: transcriptIssues.anchorStartMs,
      anchorEndMs: transcriptIssues.anchorEndMs,
      note: transcriptIssues.note,
      status: transcriptIssues.status,
      createdAt: transcriptIssues.createdAt,
      createdByName: users.name,
    })
    .from(transcriptIssues)
    .innerJoin(users, eq(users.id, transcriptIssues.createdByUserId))
    .where(eq(transcriptIssues.workspaceId, workspaceId))
    .orderBy(desc(transcriptIssues.createdAt));

  return NextResponse.json({ issues });
}

export async function POST(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; videoId: string }> }
) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const body = await req.json();
  const { issueType, anchorStartMs, anchorEndMs, note, revisionId } = body;

  if (!issueType || !note?.trim()) {
    return NextResponse.json(
      { error: "Issue type and note are required" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "Video not found" },
      { status: 404 }
    );
  }

  // Use provided revisionId or find the latest revision for this workspace
  let targetRevisionId = revisionId;
  if (!targetRevisionId) {
    const [latestRevision] = await db
      .select({ id: transcriptRevisions.id })
      .from(transcriptRevisions)
      .where(
        and(
          eq(transcriptRevisions.videoId, videoId),
          eq(transcriptRevisions.workspaceId, workspaceId)
        )
      )
      .orderBy(desc(transcriptRevisions.revisionNumber))
      .limit(1);

    if (!latestRevision) {
      return NextResponse.json(
        { error: "No transcript revisions found" },
        { status: 400 }
      );
    }
    targetRevisionId = latestRevision.id;
  }

  const [issue] = await db
    .insert(transcriptIssues)
    .values({
      workspaceId,
      revisionId: targetRevisionId,
      issueType,
      anchorStartMs: anchorStartMs ?? null,
      anchorEndMs: anchorEndMs ?? null,
      note: note.trim(),
      createdByUserId: ctx.userId,
    })
    .returning();

  return NextResponse.json({ id: issue.id }, { status: 201 });
}
