/**
 * Plain-language labels for statuses shown to church staff. The database keeps
 * its own enum values; these are the words people see.
 */

const POST_STATUS_LABELS: Record<string, string> = {
  drafting: "In progress",
  ready_for_review: "Waiting for approval",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};

const REVIEW_REQUEST_LABELS: Record<string, string> = {
  open: "Waiting",
  approved: "Approved",
  changes_requested: "Changes requested",
  cancelled: "Cancelled",
};

function fallback(status: string) {
  const words = status.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Label for a post's (content project's) status. */
export function postStatusLabel(status: string): string {
  return POST_STATUS_LABELS[status] ?? fallback(status);
}

/** Label for an approval request's status. */
export function reviewRequestLabel(status: string): string {
  return REVIEW_REQUEST_LABELS[status] ?? fallback(status);
}

/** Tailwind classes for a post status pill. */
export function postStatusTone(status: string): string {
  switch (status) {
    case "approved":
    case "published":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "ready_for_review":
      return "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "changes_requested":
      return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }
}

/**
 * The status to show for a post. A post marked as live on the website reads
 * "Published" whatever its approval status, since that is what matters next.
 */
export function displayStatus(
  status: string,
  publishedAt: Date | string | null | undefined
): string {
  return publishedAt ? "published" : status;
}
