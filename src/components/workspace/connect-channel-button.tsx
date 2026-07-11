"use client";

import { useState } from "react";

interface ConnectChannelButtonProps {
  workspaceId: string;
  workspaceSlug: string;
}

/**
 * Single entry point for connecting the user's own YouTube channel.
 * If the YouTube scope is already granted, this enqueues a sync directly;
 * otherwise it sends the user through the OAuth flow, whose callback
 * enqueues the sync itself.
 */
export function ConnectChannelButton({
  workspaceId,
  workspaceSlug,
}: ConnectChannelButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 409) {
        const data = await res.json();
        if (data.code === "youtube_not_connected") {
          const redirect = encodeURIComponent(`/w/${workspaceSlug}/library`);
          window.location.assign(
            `/api/auth/youtube-connect?workspaceId=${workspaceId}&redirect=${redirect}`
          );
          return;
        }
        setError(data.error || "Failed to connect channel");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to connect channel");
        return;
      }

      const data = await res.json();
      const params = data.runId ? `?syncRunId=${data.runId}` : "";
      window.location.assign(`/w/${workspaceSlug}/library${params}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Connecting..." : "Connect my YouTube channel"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
