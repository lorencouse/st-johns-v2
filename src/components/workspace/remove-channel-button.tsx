"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RemoveChannelButtonProps {
  workspaceId: string;
  channelId: string;
  channelTitle: string;
}

export function RemoveChannelButton({
  workspaceId,
  channelId,
  channelTitle,
}: RemoveChannelButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
    const confirmed = window.confirm(
      `Remove ${channelTitle} from this workspace? Synced videos will be removed from the library, but existing projects and drafts will stay.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/channels/${channelId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to remove channel");
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleRemove}
        disabled={loading}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
      >
        {loading ? "Removing..." : "Remove"}
      </button>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
