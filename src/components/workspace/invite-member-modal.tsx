"use client";

import { useState } from "react";

interface InviteMemberModalProps {
  workspaceId: string;
  onClose: () => void;
  onInvited: () => void;
}

interface CreatedInvite {
  email: string;
  inviteUrl: string;
  expiresAt: string;
}

const ROLES = ["admin", "editor", "reviewer", "viewer"] as const;

export function InviteMemberModal({
  workspaceId,
  onClose,
  onInvited,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send invite");
        return;
      }

      const data = await res.json();
      setCreatedInvite({
        email: data.email,
        inviteUrl: data.inviteUrl,
        expiresAt: data.expiresAt,
      });
      setCopied(false);
      onInvited();
    } catch {
      setError("Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyInvite() {
    if (!createdInvite) return;

    try {
      await navigator.clipboard.writeText(createdInvite.inviteUrl);
      setCopied(true);
    } catch {
      setError("Failed to copy invite link");
    }
  }

  if (createdInvite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Invite ready</h2>
          <p className="mt-1 text-sm text-zinc-500">
            No email is sent automatically. Share this link with{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {createdInvite.email}
            </span>
            .
          </p>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="break-all font-mono">{createdInvite.inviteUrl}</p>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Expires {new Date(createdInvite.expiresAt).toLocaleString()}.
          </p>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {copied && <p className="mt-3 text-sm text-green-600">Invite link copied.</p>}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setCreatedInvite(null);
                setCopied(false);
                setEmail("");
                setRole("editor");
                setError("");
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Create another
            </button>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Invite Member</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Send an invite link to join this workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="invite-email"
              className="block text-sm font-medium"
            >
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label
              htmlFor="invite-role"
              className="block text-sm font-medium"
            >
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
