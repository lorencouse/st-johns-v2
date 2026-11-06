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
  /** The person can check the words and start posts (owner, admin, editor). */
  canEdit: boolean;
}

/** The step a service is up to, for "Continue" links. */
export function currentServiceStep(progress: ServiceProgress): ServiceStepKey {
  if (progress.projectId) return "edit";
  if (progress.captionsReady && progress.canEdit) return "words";
  return "video";
}

/**
 * Where each step lives, for this person. Steps with no page yet, or a page
 * they cannot open, return null. Checking the words is closed once a post
 * exists, so it can never write over that post.
 */
export function serviceStepHref(
  workspaceSlug: string,
  videoId: string,
  step: ServiceStepKey,
  progress: Pick<ServiceProgress, "projectId" | "canEdit">
): string | null {
  const base = `/w/${workspaceSlug}`;
  const { projectId, canEdit } = progress;
  switch (step) {
    case "video":
      return `${base}/services/${videoId}`;
    case "words":
      return canEdit && !projectId ? `${base}/library/${videoId}/review` : null;
    case "edit":
      return projectId ? `${base}/projects/${projectId}` : null;
    case "publish":
      return projectId ? `${base}/services/${videoId}/publish` : null;
  }
}

/** Where a service's "Continue" link goes: the page for its current step. */
export function continueHref(
  workspaceSlug: string,
  videoId: string,
  progress: ServiceProgress
): string {
  return serviceStepHref(
    workspaceSlug,
    videoId,
    currentServiceStep(progress),
    progress
  )!;
}
