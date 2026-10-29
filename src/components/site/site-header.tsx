import Link from "next/link";

const textLink =
  "hidden min-h-11 items-center whitespace-nowrap text-zinc-600 hover:text-zinc-900 sm:inline-flex dark:text-zinc-400 dark:hover:text-zinc-100";

/** The public site's top bar, shared by the landing and legal pages. */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-2 sm:px-8 sm:py-4">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center whitespace-nowrap text-lg font-bold"
      >
        ContentFlow
      </Link>
      <nav className="flex items-center gap-3 text-sm sm:gap-6">
        <Link href="/privacy" className={textLink}>
          Privacy
        </Link>
        <Link href="/terms" className={textLink}>
          Terms
        </Link>
        <Link
          href="/signin"
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg bg-zinc-900 px-4 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
