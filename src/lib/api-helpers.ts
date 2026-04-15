import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users, workspaceMembers, workspaces } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export type UserRole = "user" | "premium" | "admin";

export async function getUserRole(userId: string): Promise<UserRole> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.role ?? "user";
}

export async function requireApiWorkspaceMember(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const [membership] = await db
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaceMembers.userId, session.user.id)
      )
    )
    .limit(1);

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
