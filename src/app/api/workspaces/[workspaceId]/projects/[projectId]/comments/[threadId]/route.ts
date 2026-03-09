import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { commentThreads, comments } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

// Add a reply to a thread
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      workspaceId: string;
      projectId: string;
      threadId: string;
    }>;
  }
) {
  const { workspaceId, threadId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const body = await req.json();
  if (!body.comment?.trim()) {
    return NextResponse.json(
      { error: "Comment body is required" },
      { status: 400 }
    );
  }

  // Verify thread exists in workspace
  const [thread] = await db
    .select()
    .from(commentThreads)
    .where(
      and(
        eq(commentThreads.id, threadId),
        eq(commentThreads.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!thread) {
    return NextResponse.json(
      { error: "Thread not found" },
      { status: 404 }
    );
  }

  const [newComment] = await db
    .insert(comments)
    .values({
      threadId,
      userId: ctx.userId,
      body: body.comment.trim(),
    })
    .returning();

  return NextResponse.json({ commentId: newComment.id }, { status: 201 });
}

// Resolve a thread
export async function PATCH(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      workspaceId: string;
      projectId: string;
      threadId: string;
    }>;
  }
) {
  const { workspaceId, threadId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  await db
    .update(commentThreads)
    .set({
      resolvedAt: new Date(),
      resolvedByUserId: ctx.userId,
    })
    .where(
      and(
        eq(commentThreads.id, threadId),
        eq(commentThreads.workspaceId, workspaceId)
      )
    );

  return NextResponse.json({ ok: true });
}
