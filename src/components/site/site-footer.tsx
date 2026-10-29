import Link from "next/link";

const footerLink =
  "inline-flex min-h-11 items-center whitespace-nowrap px-2 transition-colors duration-150";

/** The public site's one quiet footer, shared by the landing, legal and sign-in pages. */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-7xl px-4 pt-[20svh] pb-6 text-sm sm:px-8 lg:grid lg:grid-cols-12 lg:gap-x-8">
      <div className="flex flex-col gap-2 lg:col-span-8 lg:col-start-3 lg:flex-row lg:items-baseline lg:justify-between">
        <p className="text-zinc-600 dark:text-zinc-400">Sermons into blog posts</p>
        <div className="-mx-2 flex flex-wrap">
          <Link href="/privacy" className={footerLink}>
            Privacy
          </Link>
          <Link href="/terms" className={footerLink}>
            Terms
          </Link>
          <a href="mailto:support@dotdasher.com" className={footerLink}>
            Contact
          </a>
        </div>
        <p className="text-zinc-600 tabular-nums dark:text-zinc-400">&copy; {new Date().getFullYear()} ContentFlow</p>
      </div>
    </footer>
  );
}
