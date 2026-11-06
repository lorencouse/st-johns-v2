import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { parsePublishedUrl } from "@/lib/published-url";
import { db } from "@/server/db";
import { auditEvents, contentProjects } from "@/server/db/schema";

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

async function loadEditableProject(workspaceId: string, projectId: string) {
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return { error: ctx.error };
  if (!["owner", "admin", "editor"].includes(ctx.role)) {
    return {
      error: NextResponse.json(
        { error: "You need editing access to change this." },
        { status: 403 }
      ),
    };
  }
  const [project] = await db
    .select({ id: contentProjects.id, title: contentProjects.title })
    .from(contentProjects)
    .where(
      and(
        eq(contentProjects.id, projectId),
        eq(contentProjects.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!project) {
    return {
      error: NextResponse.json({ error: "Post not found" }, { status: 404 }),
    };
  }
  return { ctx, project };
}

/** Mark the post as live on the church's website, with an optional link. */
export async function POST(req: NextRequest, { params }: Params) {
  const { workspaceId, projectId } = await params;
  const loaded = await loadEditableProject(workspaceId, projectId);
  if ("error" in loaded) return loaded.error;
  const { ctx, project } = loaded;

  const body = await req.json().catch(() => ({}));
  const parsed = parsePublishedUrl(body?.url);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const now = new Date();
  const [saved] = await db
    .update(contentProjects)
    .set({
      publishedAt: sql`coalesce(${contentProjects.publishedAt}, ${now.toISOString()}::timestamptz)`,
      publishedUrl: parsed.url,
      updatedAt: now,
    })
    .where(eq(contentProjects.id, projectId))
    .returning({ publishedAt: contentProjects.publishedAt });
  const publishedAt = saved?.publishedAt ?? now;

  if (publishedAt.getTime() === now.getTime()) {
    await db.insert(auditEvents).values({
      workspaceId,
      actorUserId: ctx.userId,
      eventKey: "post.published",
      entityType: "content_project",
      entityId: projectId,
      summary: `Marked "${project.title}" as published`,
    });
  }

  return NextResponse.json({
    publishedAt: publishedAt.toISOString(),
    publishedUrl: parsed.url,
  });
}

/** Undo "I've published it", for a post marked by mistake. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { workspaceId, projectId } = await params;
  const loaded = await loadEditableProject(workspaceId, projectId);
  if ("error" in loaded) return loaded.error;
  const { ctx, project } = loaded;

  await db
    .update(contentProjects)
    .set({ publishedAt: null, publishedUrl: null, updatedAt: new Date() })
    .where(eq(contentProjects.id, projectId));

  await db.insert(auditEvents).values({
    workspaceId,
    actorUserId: ctx.userId,
    eventKey: "post.unpublished",
    entityType: "content_project",
    entityId: projectId,
    summary: `Marked "${project.title}" as not published`,
  });

  return NextResponse.json({ publishedAt: null, publishedUrl: null });
}
