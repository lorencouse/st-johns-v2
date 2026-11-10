import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { and, eq, type SQL } from "drizzle-orm";
import { redirect } from "next/navigation";

/** The user's membership of the workspace `match` picks out, if they have one. */
export async function findMembership(userId: string, match: SQL) {
  const [membership] = await db
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(match, eq(workspaceMembers.userId, userId)))
    .limit(1);
  return membership;
}

export async function requireWorkspaceMember(workspaceSlug: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const membership = await findMembership(
    session.user.id,
    eq(workspaces.slug, workspaceSlug)
  );
  if (!membership) redirect("/app");

  return {
    session,
    workspace: membership.workspace,
    role: membership.role,
    userId: session.user.id,
  };
}
