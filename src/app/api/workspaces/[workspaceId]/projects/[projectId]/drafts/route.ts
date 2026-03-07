import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { draftVersions, contentProjects } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

// PATCH: Save draft content (auto-save from editor)
export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
  const { workspaceId, projectId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  if (!["owner", "admin", "editor"].includes(ctx.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json();
  const { draftVersionId, contentJson, plainText, intro, summary, title } = body;

  if (!draftVersionId) {
    return NextResponse.json({ error: "draftVersionId required" }, { status: 400 });
  }

  // Verify draft belongs to this project and workspace
  const [draft] = await db
    .select()
    .from(draftVersions)
    .where(
      and(
        eq(draftVersions.id, draftVersionId),
        eq(draftVersions.contentProjectId, projectId),
        eq(draftVersions.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  if (draft.status !== "working") {
    return NextResponse.json(
      { error: "Cannot edit a non-working draft" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (contentJson !== undefined) updates.contentJson = contentJson;
  if (plainText !== undefined) updates.plainText = plainText;
  if (intro !== undefined) updates.intro = intro;
  if (summary !== undefined) updates.summary = summary;
  if (title !== undefined) updates.title = title;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db
    .update(draftVersions)
    .set(updates)
    .where(eq(draftVersions.id, draftVersionId));

  // Also update project title if changed
  if (title) {
    await db
      .update(contentProjects)
      .set({ title, updatedAt: new Date() })
      .where(eq(contentProjects.id, projectId));
  }

  return NextResponse.json({ ok: true });
}
