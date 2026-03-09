import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  workspaceMembers,
  workspaceInvites,
  users,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { MembersClient } from "@/components/workspace/members-client";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  const members = await db
    .select({
      id: workspaceMembers.id,
      role: workspaceMembers.role,
      userName: users.name,
      userEmail: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspace.id));

  const pendingInvites = await db
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      status: workspaceInvites.status,
      expiresAt: workspaceInvites.expiresAt,
    })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspace.id),
        eq(workspaceInvites.status, "pending")
      )
    );

  return (
    <MembersClient
      workspaceId={workspace.id}
      members={members}
      pendingInvites={pendingInvites.map((inv) => ({
        ...inv,
        expiresAt: inv.expiresAt.toISOString(),
      }))}
      userRole={role}
    />
  );
}
