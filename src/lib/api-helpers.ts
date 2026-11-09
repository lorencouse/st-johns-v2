import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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
