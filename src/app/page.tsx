import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 sm:px-8">
        <span className="text-lg font-bold">ContentFlow</span>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/privacy" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Privacy
          </Link>
          <Link href="/terms" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Terms
          </Link>
          <Link
            href="/signin"
            className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Turn your YouTube videos into blog-ready content
        </h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Connect your channel, auto-generate transcripts, polish drafts with
          AI, and export HTML or Markdown for any CMS. All in one workspace.
        </p>
        <Link
          href="/signin"
          className="mt-2 rounded-lg bg-zinc-900 px-8 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Get Started Free
        </Link>
      </section>

      {/* How it works */}
      <section className="mx-auto grid max-w-5xl gap-8 px-6 py-20 sm:grid-cols-3 sm:px-8">
        <div>
          <div className="mb-3 text-2xl font-bold text-zinc-300 dark:text-zinc-700">1</div>
          <h3 className="font-semibold">Connect your channel</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in with Google and your YouTube library syncs automatically.
            Channels, playlists, and videos — all imported.
          </p>
        </div>
        <div>
          <div className="mb-3 text-2xl font-bold text-zinc-300 dark:text-zinc-700">2</div>
          <h3 className="font-semibold">Generate and edit</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            AI cleans up transcripts and generates blog drafts. Use the
            built-in editor to review and refine before publishing.
          </p>
        </div>
        <div>
          <div className="mb-3 text-2xl font-bold text-zinc-300 dark:text-zinc-700">3</div>
          <h3 className="font-semibold">Export anywhere</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Export polished articles as HTML or Markdown, ready to paste into
            WordPress, Ghost, Substack, or any CMS.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 px-6 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500 sm:px-8">
        <div className="flex items-center justify-center gap-4">
          <span>&copy; {new Date().getFullYear()} ContentFlow</span>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
