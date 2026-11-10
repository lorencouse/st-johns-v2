"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, ExternalLink, Loader2, MonitorPlay, TriangleAlert } from "lucide-react";
import { RunStatus } from "@/components/studio/run-status";
import { serviceStepHref } from "@/lib/service-steps";
import { ServiceStepFrame } from "./service-step-frame";
import { buttonStepBack, buttonStepPrimary } from "@/components/ui/button";

interface CheckVideoClientProps {
  workspaceId: string;
  workspaceSlug: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  captionsReady: boolean;
  captionsFailed: boolean;
  notAiredYet: boolean;
  canEdit: boolean;
  projectId: string | null;
}

export function CheckVideoClient({
  workspaceId,
  workspaceSlug,
  videoId,
  title,
  thumbnailUrl,
  publishedAt,
  captionsReady,
  captionsFailed,
  notAiredYet,
  canEdit,
  projectId,
}: CheckVideoClientProps) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  const startCaptions = useCallback(async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/videos/${videoId}/ingest`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "We couldn't start getting the captions.");
        return;
      }
      setRunId(data.runId);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }, [workspaceId, videoId]);

  // Getting captions is the only thing this step needs, so it starts on its
  // own, exactly as if the person had pressed the button. A failed earlier
  // attempt waits for an explicit retry instead of looping.
  const shouldAutoStart = !captionsReady && !captionsFailed && !notAiredYet && canEdit;
  useEffect(() => {
    if (!shouldAutoStart || startedRef.current) return;
    // Deferred so the state updates happen outside the effect's own pass.
    const timer = setTimeout(() => {
      startedRef.current = true;
      void startCaptions();
    }, 0);
    return () => clearTimeout(timer);
  }, [shouldAutoStart, startCaptions]);

  const date = publishedAt
    ? new Date(publishedAt).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const nextHref = captionsReady
    ? serviceStepHref(workspaceSlug, videoId, projectId ? "edit" : "documents", {
        projectId,
        canEdit,
      })
    : null;

  return (
    <ServiceStepFrame
      steps={{ workspaceSlug, videoId, projectId, canEdit, current: "video" }}
      title="Is this the right service?"
      description={
        <>
          Check the video, then we&apos;ll get the spoken words from YouTube.
        </>
      }
      footer={
        <>
          <Link
            href={`/w/${workspaceSlug}/library`}
            className={buttonStepBack}
          >
            Back
          </Link>
          {nextHref ? (
            <Link
              href={nextHref}
              className={buttonStepPrimary}
            >
              {projectId ? "Go to the post" : "Yes, this is the one"}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex min-h-12 flex-1 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-lg bg-blue-600/40 px-6 text-base font-semibold text-white sm:flex-none"
            >
              Continue
            </span>
          )}
        </>
      }
    >
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="aspect-video w-full max-w-full shrink-0 overflow-hidden rounded-xl bg-zinc-100 sm:w-56 dark:bg-zinc-900">
            {thumbnailUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-500 dark:text-zinc-400">
                <MonitorPlay className="h-10 w-10" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold text-balance">{title}</h2>
            {date && <p className="text-sm text-zinc-500">{date}</p>}
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Watch on YouTube
            </a>
          </div>
        </div>
      </section>

      <section aria-live="polite" className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
        {captionsReady ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
              <CircleCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
              We have the spoken words from this service.
            </p>
            {!nextHref && (
              <p className="text-zinc-600 dark:text-zinc-300">
                Someone with editing access needs to start the post.
              </p>
            )}
          </div>
        ) : notAiredYet ? (
          <p className="text-zinc-600 dark:text-zinc-300">
            This service hasn&apos;t finished airing yet. Come back once it
            has, and we&apos;ll get the words then.
          </p>
        ) : !canEdit ? (
          <p className="text-zinc-600 dark:text-zinc-300">
            Someone with editing access needs to start this service.
          </p>
        ) : runId ? (
          <RunStatus
            runId={runId}
            onSuccess={() => {
              setRunId(null);
              router.refresh();
            }}
            onRetry={() => {
              setRunId(null);
              void startCaptions();
            }}
            onDismiss={() => {
              setRunId(null);
              router.refresh();
            }}
          />
        ) : error || captionsFailed ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-zinc-700 dark:text-zinc-200">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <span>
                {error ||
                  "We couldn't get the words from YouTube last time. This can happen when YouTube hasn't made captions yet."}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void startCaptions()}
              disabled={starting}
              className="min-h-11 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Try again
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
            Getting the spoken words from YouTube...
          </p>
        )}
      </section>
    </ServiceStepFrame>
  );
}
