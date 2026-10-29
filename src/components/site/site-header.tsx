import Link from "next/link";

const navLink =
  "inline-flex min-h-11 items-center whitespace-nowrap px-2 transition-colors duration-150";

/**
 * The public site's one black band, shared by the landing, legal and sign-in
 * pages: the wordmark and the nav, then whatever the page sets inside the band
 * (the landing's hero).
 */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-black text-white dark:bg-zinc-900">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:px-8" aria-label="Main">
        <Link href="/" className={`${navLink} -ml-2 text-lg font-semibold`}>
          ContentFlow
        </Link>
        <div className="flex items-center gap-1 text-base">
          <Link href="/privacy" className={`${navLink} text-zinc-300 hover:text-white`}>
            Privacy
          </Link>
          <Link href="/terms" className={`${navLink} text-zinc-300 hover:text-white max-sm:hidden`}>
            Terms
          </Link>
          <Link href="/signin" className={`${navLink} -mr-2 font-medium underline-offset-4 hover:underline`}>
            Sign in
          </Link>
        </div>
      </nav>
      {children}
    </header>
  );
}
