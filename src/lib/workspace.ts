import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function requireWorkspaceMember(workspaceSlug: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const result = await db
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaces.slug, workspaceSlug),
        eq(workspaceMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (result.length === 0) redirect("/app");

  return {
    session,
    workspace: result[0].workspace,
    role: result[0].role,
    userId: session.user.id,
  };
}

export type WorkspaceContext = Awaited<
  ReturnType<typeof requireWorkspaceMember>
>;
