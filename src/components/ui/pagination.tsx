"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  /** Rows across every page of the current view, not just this one. */
  total: number;
  /** Noun for the count line, e.g. "video" or "project". */
  label?: string;
}

/**
 * Page controls that drive the URL, so the server component above them can do
 * the paging in SQL. Reads `page`/`pageSize`; leaves other params alone.
 */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  label = "item",
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const search = params.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  function goToPage(next: number) {
    setParams({ page: next <= 1 ? null : String(next) });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const buttonClass =
    "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition enabled:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:enabled:hover:bg-zinc-800";

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-500">
        Showing{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {rangeStart}
        </span>
        –
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {rangeEnd}
        </span>{" "}
        of{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {total}
        </span>{" "}
        {label}
        {total === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="hidden sm:inline">Per page</span>
          <select
            value={pageSize}
            disabled={isPending}
            onChange={(event) =>
              setParams({
                pageSize:
                  Number(event.target.value) === DEFAULT_PAGE_SIZE
                    ? null
                    : event.target.value,
                page: null,
              })
            }
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={buttonClass}
          disabled={isPending || page <= 1}
          onClick={() => goToPage(1)}
          aria-label="First page"
        >
          «
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={isPending || page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </button>
        <span className="px-1 text-sm text-zinc-500">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className={buttonClass}
          disabled={isPending || page >= pageCount}
          onClick={() => goToPage(page + 1)}
        >
          Next
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={isPending || page >= pageCount}
          onClick={() => goToPage(pageCount)}
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
