import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { workspaceMembers, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const members = await db
    .select({
      member: workspaceMembers,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspace.id));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Members</h1>
        <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
          Invite member
        </button>
      </div>

      <div className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-zinc-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map(({ member, userName, userEmail }) => (
              <tr
                key={member.id}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="py-3 pr-4 font-medium">
                  {userName || "Unnamed"}
                </td>
                <td className="py-3 pr-4 text-zinc-500">{userEmail}</td>
                <td className="py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                    {member.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
