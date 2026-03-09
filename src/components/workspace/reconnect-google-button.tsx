"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export function ReconnectGoogleButton({ redirectPath }: { redirectPath: string }) {
  const [status, setStatus] = useState<{
    connected: boolean;
    hasYoutubeScope: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/youtube-status")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const needsReconnect = status && (!status.connected || !status.hasYoutubeScope);

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Google Account</h3>
          {needsReconnect ? (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
              YouTube access is missing. Reconnect your Google account and make
              sure to check all permission boxes.
            </p>
          ) : (
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">
              Connected with YouTube access
            </p>
          )}
        </div>
        <button
          onClick={() =>
            signIn("google", { callbackUrl: redirectPath })
          }
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            needsReconnect
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          }`}
        >
          {needsReconnect ? "Reconnect Google Account" : "Reconnect"}
        </button>
      </div>
    </div>
  );
}
