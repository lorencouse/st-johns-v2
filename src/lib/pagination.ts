export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;

/** Page size from a URL param, restricted to the sizes the UI offers. */
export function parsePageSize(value: string | undefined) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

/** 1-based page number from a URL param; anything junk means page 1. */
export function parsePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Clamp a requested page to a list that may have shrunk since it was linked. */
export function resolvePaging(
  total: number,
  requestedPage: number,
  pageSize: number
) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  return { page, pageCount, offset: (page - 1) * pageSize };
}
