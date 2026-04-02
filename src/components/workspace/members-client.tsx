"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InviteMemberModal } from "./invite-member-modal";

interface Member {
  id: string;
  role: string;
  userName: string | null;
  userEmail: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

interface MembersClientProps {
  workspaceId: string;
  members: Member[];
  pendingInvites: PendingInvite[];
  userRole: string;
}

export function MembersClient({
  workspaceId,
  members,
  pendingInvites,
  userRole,
}: MembersClientProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const router = useRouter();
  const canInvite = ["owner", "admin"].includes(userRole);

  async function handleRevokeInvite(inviteId: string) {
    await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Members</h1>
        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Invite member
          </button>
        )}
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
            {members.map((m) => (
              <tr
                key={m.id}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="py-3 pr-4 font-medium">
                  {m.userName || "Unnamed"}
                </td>
                <td className="py-3 pr-4 text-zinc-500">{m.userEmail}</td>
                <td className="py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                    {m.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingInvites.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Pending Invites</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Expires</th>
                {canInvite && <th className="pb-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-3 pr-4 text-zinc-500">{inv.email}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                      {inv.role}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-zinc-400 text-xs">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  {canInvite && (
                    <td className="py-3">
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Revoke
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInviteModal && (
        <InviteMemberModal
          workspaceId={workspaceId}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
