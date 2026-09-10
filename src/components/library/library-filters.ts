export const FILTER_KEYS = [
  "all",
  "needs_captions",
  "ready_to_draft",
  "drafting",
  "review_queue",
  "approved",
  "no_project",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

export const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All videos",
  needs_captions: "Needs captions",
  ready_to_draft: "Ready to draft",
  drafting: "Drafting",
  review_queue: "Review queue",
  approved: "Approved",
  no_project: "No project",
};
