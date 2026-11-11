import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceRole } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { draftVersions, contentProjects } from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { savesAnEdit } from "@/server/content/redo-guard";
import { SAVE_STAMP_KEY, isStaleSave, parseSaveStamp } from "@/lib/save-order";

// PATCH: Save draft content (auto-save from editor)
export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
  const { workspaceId, projectId } = await params;
  const ctx = await requireApiWorkspaceRole(workspaceId, "edit");
  if ("error" in ctx) return ctx.error;

  const body = await req.json();
  const { draftVersionId, contentJson, plainText, intro, summary, title } = body;
  const saveStamp = parseSaveStamp(body.saveStamp);

  if (!draftVersionId) {
    return NextResponse.json({ error: "draftVersionId required" }, { status: 400 });
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

  // The row stays locked until the write, so two saves from one page cannot
  // both pass the order check below.
  const result = await db.transaction(async (tx) => {
    // Verify draft belongs to this project and workspace
    const [draft] = await tx
      .select()
      .from(draftVersions)
      .where(
        and(
          eq(draftVersions.id, draftVersionId),
          eq(draftVersions.contentProjectId, projectId),
          eq(draftVersions.workspaceId, workspaceId)
        )
      )
      .limit(1)
      .for("update");

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (draft.status !== "working") {
      return NextResponse.json(
        { error: "Cannot edit a non-working draft" },
        { status: 400 }
      );
    }

    // A save that arrives after a later one from the same page (the page
    // closed while it was on its way, or gave up waiting for it) would put
    // older text back. The later save already carried these fields.
    const meta = (draft.metadataJson ?? {}) as Record<string, unknown>;
    if (isStaleSave(parseSaveStamp(meta[SAVE_STAMP_KEY]), saveStamp)) {
      return NextResponse.json({ ok: true, skipped: "stale" });
    }

    const metaPatch: Record<string, unknown> = {};
    if (saveStamp) metaPatch[SAVE_STAMP_KEY] = saveStamp;
    // Mark the draft as human-edited so a batch regeneration keeps it.
    if (savesAnEdit(draft, { contentJson, intro, summary, title })) {
      metaPatch.humanEditedAt = new Date().toISOString();
    }
    const set: Record<string, unknown> = { ...updates };
    if (Object.keys(metaPatch).length > 0) {
      set.metadataJson = sql`${draftVersions.metadataJson} || ${JSON.stringify(metaPatch)}::jsonb`;
    }

    await tx
      .update(draftVersions)
      .set(set)
      .where(eq(draftVersions.id, draftVersionId));

    // Also update project title if changed
    if (title) {
      await tx
        .update(contentProjects)
        .set({ title, updatedAt: new Date() })
        .where(eq(contentProjects.id, projectId));
    }
    return null;
  });
  if (result) return result;

  return NextResponse.json({ ok: true });
}
