import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          ContentFlow
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Turn your YouTube video library into publish-ready blog content.
          Connect your channel, generate transcripts, edit drafts, and export
          HTML or Markdown for any CMS.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/signin"
          className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
