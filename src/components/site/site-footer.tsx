import Link from "next/link";

const footerLink =
  "inline-flex min-h-11 items-center whitespace-nowrap hover:text-zinc-900 dark:hover:text-zinc-100";

/**
 * The public site's footer, shared by the landing and legal pages. On phones
 * the items stack so none of them wraps; from `sm` up they sit on one line.
 */
export function SiteFooter() {
  return (
    <footer className="px-4 py-8 text-sm text-zinc-600 sm:px-8 dark:text-zinc-400">
      <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-center sm:gap-6">
        <span className="inline-flex min-h-11 items-center whitespace-nowrap">
          &copy; {new Date().getFullYear()} ContentFlow
        </span>
        <Link href="/privacy" className={footerLink}>
          Privacy policy
        </Link>
        <Link href="/terms" className={footerLink}>
          Terms of service
        </Link>
      </div>
    </footer>
  );
}
