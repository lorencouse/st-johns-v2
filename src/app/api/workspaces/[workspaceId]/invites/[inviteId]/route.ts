import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceRole } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { workspaceInvites } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; inviteId: string }> }
) {
  const { workspaceId, inviteId } = await params;
  const ctx = await requireApiWorkspaceRole(workspaceId, "admin", "Forbidden");
  if ("error" in ctx) return ctx.error;

  await db
    .update(workspaceInvites)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, workspaceId),
        eq(workspaceInvites.status, "pending")
      )
    );

  return NextResponse.json({ ok: true });
}
