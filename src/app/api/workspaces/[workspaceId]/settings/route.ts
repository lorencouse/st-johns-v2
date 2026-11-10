import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceRole } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const ctx = await requireApiWorkspaceRole(workspaceId, "admin", "Forbidden");
  if ("error" in ctx) return ctx.error;

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }

  if (typeof body.timezone === "string" && body.timezone.trim()) {
    updates.timezone = body.timezone.trim();
  }

  if (typeof body.slug === "string" && body.slug.trim()) {
    const newSlug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    // Check uniqueness
    const [existing] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, newSlug))
      .limit(1);

    if (existing && existing.id !== workspaceId) {
      return NextResponse.json(
        { error: "Slug already taken" },
        { status: 409 }
      );
    }
    updates.slug = newSlug;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(workspaces)
    .set(updates)
    .where(eq(workspaces.id, workspaceId))
    .returning();

  return NextResponse.json(updated);
}
