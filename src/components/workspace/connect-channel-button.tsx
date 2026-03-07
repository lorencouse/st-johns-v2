"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RunStatus } from "@/components/studio/run-status";

interface ConnectChannelButtonProps {
  workspaceId: string;
}

export function ConnectChannelButton({
  workspaceId,
}: ConnectChannelButtonProps) {
  const router = useRouter();
  const [channelUrl, setChannelUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleConnect(useOwn: boolean) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useOwn ? {} : { channelUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to connect channel");
        return;
      }

      const data = await res.json();
      setRunId(data.runId);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (runId) {
    return (
      <div className="space-y-3">
        <RunStatus
          runId={runId}
          onComplete={() => {
            router.refresh();
            setRunId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => handleConnect(true)}
        disabled={loading}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Connecting..." : "Connect my YouTube channel"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-zinc-400 dark:bg-zinc-950">
            or enter a channel URL
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={channelUrl}
          onChange={(e) => setChannelUrl(e.target.value)}
          placeholder="https://youtube.com/@channel"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={() => handleConnect(false)}
          disabled={loading || !channelUrl.trim()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sync
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
