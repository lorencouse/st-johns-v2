/**
 * The guided path every service follows, from its YouTube video to a
 * published post. The sermon and bulletin upload step joins this list when
 * document upload is built.
 */
export const SERVICE_STEPS = [
  { key: "video", label: "Check the video" },
  { key: "words", label: "Check the words" },
  { key: "edit", label: "Edit the post" },
  { key: "publish", label: "Publish" },
] as const;

export type ServiceStepKey = (typeof SERVICE_STEPS)[number]["key"];

export interface ServiceProgress {
  /** Captions (or a stored transcript) exist for the video. */
  captionsReady: boolean;
  /** The post's id, once one has been started. */
  projectId: string | null;
}

/** The step a service is up to, for "Continue" links. */
export function currentServiceStep(progress: ServiceProgress): ServiceStepKey {
  if (progress.projectId) return "edit";
  if (progress.captionsReady) return "words";
  return "video";
}

/** Where each step lives. Steps with no page yet return null. */
export function serviceStepHref(
  workspaceSlug: string,
  videoId: string,
  step: ServiceStepKey,
  projectId: string | null
): string | null {
  const base = `/w/${workspaceSlug}`;
  switch (step) {
    case "video":
      return `${base}/services/${videoId}`;
    case "words":
      return `${base}/library/${videoId}/review`;
    case "edit":
      return projectId ? `${base}/projects/${projectId}` : null;
    case "publish":
      return projectId ? `${base}/projects/${projectId}#publish` : null;
  }
}

/** The single entry point for a service: its page sends people onward. */
export function servicePath(workspaceSlug: string, videoId: string): string {
  return `/w/${workspaceSlug}/services/${videoId}`;
}
