"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function ReconnectGoogleButton({
  redirectPath,
  workspaceId,
}: {
  redirectPath: string;
  workspaceId: string;
}) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<{
    connected: boolean;
    hasYoutubeScope: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const youtubeError = searchParams.get("youtube_error");

  useEffect(() => {
    fetch("/api/auth/youtube-status")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const isConnected = status?.connected ?? false;
  const hasYoutube = status?.hasYoutubeScope ?? false;

  return (
    <div className="space-y-4">
      {/* Google Account */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Google Account</h3>
            {isConnected ? (
              <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                Connected
              </p>
            ) : (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                Not connected
              </p>
            )}
          </div>
          <button
            onClick={() => signIn("google", { callbackUrl: redirectPath })}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              !isConnected
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {isConnected ? "Reconnect" : "Connect Google Account"}
          </button>
        </div>
      </div>

      {/* YouTube Access */}
      {isConnected && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">YouTube Access</h3>
              {hasYoutube ? (
                <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                  YouTube access granted
                </p>
              ) : (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Grant access to fetch captions and channel data from YouTube.
                </p>
              )}
              {youtubeError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  YouTube connection failed: {youtubeError.replace(/_/g, " ")}
                </p>
              )}
            </div>
            {!hasYoutube ? (
              <a
                href={`/api/auth/youtube-connect?redirect=${encodeURIComponent(redirectPath)}&workspaceId=${encodeURIComponent(workspaceId)}`}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Connect YouTube
              </a>
            ) : (
              <a
                href={`/api/auth/youtube-connect?redirect=${encodeURIComponent(redirectPath)}&workspaceId=${encodeURIComponent(workspaceId)}`}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Reconnect
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
