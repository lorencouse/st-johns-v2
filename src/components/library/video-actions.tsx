import Link from "next/link";
import { currentServiceStep, serviceStepHref } from "@/lib/service-steps";

interface VideoActionsProps {
  videoId: string;
  workspaceSlug: string;
  ingestStatus: string;
  /** Premiere or stream that has not finished airing, so nothing to do yet. */
  isScheduled?: boolean;
  project: { id: string; status: string } | null;
  /** "large" renders a full-size button for a featured card. */
  size?: "default" | "large";
}

/**
 * The one next step for a video: a single link into its guided path. Getting
 * captions starts on the service's own page, so rows never fetch directly.
 */
export function VideoActions({
  videoId,
  workspaceSlug,
  ingestStatus,
  isScheduled = false,
  project,
  size = "default",
}: VideoActionsProps) {
  if (isScheduled) {
    return <span className="whitespace-nowrap text-xs text-zinc-400">Not aired yet</span>;
  }

  const projectId = project?.id ?? null;
  const step = currentServiceStep({
    captionsReady: ingestStatus === "captions_available",
    projectId,
  });
  const href =
    serviceStepHref(workspaceSlug, videoId, step, projectId) ??
    serviceStepHref(workspaceSlug, videoId, "video", null)!;

  const label =
    size === "large"
      ? step === "edit"
        ? "Continue the post"
        : "Start the post"
      : step === "edit"
        ? "Continue"
        : "Start";

  const sizing =
    size === "large"
      ? "min-h-12 rounded-lg px-6 text-base font-semibold"
      : "min-h-9 rounded-md px-3 text-xs font-medium pointer-coarse:min-h-11";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 ${sizing}`}
    >
      {label}
    </Link>
  );
}
