import { auth } from "@/server/auth";
import { workspaces } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { findMembership } from "@/lib/workspace";
import { can, type Permission } from "@/lib/permissions";

export async function requireApiWorkspaceMember(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const membership = await findMembership(
    session.user.id,
    eq(workspaces.id, workspaceId)
  );
  if (!membership) {
    return { error: NextResponse.json({ error: "Not a workspace member" }, { status: 403 }) };
  }

  return {
    session,
    workspace: membership.workspace,
    role: membership.role,
    userId: session.user.id,
  };
}

/** Like requireApiWorkspaceMember, but the member's role must also allow `permission`. */
export async function requireApiWorkspaceRole(
  workspaceId: string,
  permission: Permission,
  message = "Insufficient permissions"
) {
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx;
  if (!can(ctx.role, permission)) {
    return { error: NextResponse.json({ error: message }, { status: 403 }) };
  }
  return ctx;
}
