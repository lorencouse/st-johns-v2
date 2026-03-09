import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  commentThreads,
  comments,
  users,
  contentProjects,
} from "@/server/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
  const { workspaceId, projectId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const threads = await db
    .select({
      id: commentThreads.id,
      anchorType: commentThreads.anchorType,
      anchorKey: commentThreads.anchorKey,
      anchorJson: commentThreads.anchorJson,
      createdAt: commentThreads.createdAt,
      resolvedAt: commentThreads.resolvedAt,
      createdByName: users.name,
    })
    .from(commentThreads)
    .innerJoin(users, eq(users.id, commentThreads.createdByUserId))
    .where(
      and(
        eq(commentThreads.contentProjectId, projectId),
        eq(commentThreads.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(commentThreads.createdAt));

  const threadIds = threads.map((t) => t.id);
  let allComments: Array<{
    id: string;
    threadId: string;
    body: string;
    createdAt: Date;
    userName: string | null;
    deletedAt: Date | null;
  }> = [];

  if (threadIds.length > 0) {
    for (const threadId of threadIds) {
      const threadComments = await db
        .select({
          id: comments.id,
          threadId: comments.threadId,
          body: comments.body,
          createdAt: comments.createdAt,
          userName: users.name,
          deletedAt: comments.deletedAt,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.userId))
        .where(
          and(eq(comments.threadId, threadId), isNull(comments.deletedAt))
        )
        .orderBy(comments.createdAt);

      allComments = allComments.concat(threadComments);
    }
  }

  return NextResponse.json({
    threads: threads.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
      comments: allComments
        .filter((c) => c.threadId === t.id)
        .map((c) => ({
          id: c.id,
          body: c.body,
          userName: c.userName,
          createdAt: c.createdAt.toISOString(),
        })),
    })),
  });
}

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
  const { anchorType, anchorKey, comment: commentBody, draftVersionId } = body;

  if (!commentBody?.trim()) {
    return NextResponse.json(
      { error: "Comment body is required" },
      { status: 400 }
    );
  }

  // Verify project exists
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

  if (!project || !project.activeDraftVersionId) {
    return NextResponse.json(
      { error: "Project or draft not found" },
      { status: 404 }
    );
  }

  const [thread] = await db
    .insert(commentThreads)
    .values({
      workspaceId,
      contentProjectId: projectId,
      draftVersionId: draftVersionId || project.activeDraftVersionId,
      anchorType: anchorType || "document",
      anchorKey: anchorKey || null,
      createdByUserId: ctx.userId,
    })
    .returning();

  const [newComment] = await db
    .insert(comments)
    .values({
      threadId: thread.id,
      userId: ctx.userId,
      body: commentBody.trim(),
    })
    .returning();

  return NextResponse.json(
    { threadId: thread.id, commentId: newComment.id },
    { status: 201 }
  );
}
