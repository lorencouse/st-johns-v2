import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Literata } from "next/font/google";
import { Play } from "lucide-react";
import { TRANSCRIPT_DISCLAIMER } from "@/lib/disclaimer";
import { channel, library, post, service } from "@/app/landing-service";
import { PassageStates } from "@/components/landing/passage-states";
import { QuestionIndex, type Question } from "@/components/landing/question-index";
import { CopyPostButton } from "@/components/landing/copy-post-button";

// The public pages are set in Literata; the app keeps its own face, and the
// product fragments on this page use it (`font-sans`) so they look like the app.
const literata = Literata({ subsets: ["latin"], display: "swap" });

const HEADLINE = "Sunday's sermon, Monday's blog post";
const SUMMARY =
  "ContentFlow turns your church's YouTube livestreams into edited, headed blog posts you can paste into Squarespace or any CMS.";

export const metadata: Metadata = {
  title: `ContentFlow: ${HEADLINE}`,
  description: SUMMARY,
  openGraph: {
    type: "website",
    siteName: "ContentFlow",
    title: HEADLINE,
    description: SUMMARY,
  },
  twitter: {
    card: "summary",
    title: HEADLINE,
    description: SUMMARY,
  },
};

const ACCESS_EMAIL =
  "mailto:support@dotdasher.com?subject=" +
  encodeURIComponent("ContentFlow access for our church") +
  "&body=" +
  encodeURIComponent("Church name:\nYouTube channel:\nWho will edit and approve posts:\n");

// One column, sharing one left edge from the hero to the footer: the full
// width on a phone, the middle of a 12-column grid on a wide screen.
const FRAME = "mx-auto w-full max-w-7xl px-4 sm:px-8";
const GRID = "lg:grid lg:grid-cols-12 lg:gap-x-8";
const COLUMN = "lg:col-span-6 lg:col-start-4";
// Wider pieces break out of the column by one grid column on each side.
const WIDE = "lg:col-span-8 lg:col-start-3";

const NAV_LINK =
  "inline-flex min-h-11 items-center whitespace-nowrap px-2 transition-colors duration-150";

const passageSection = post.sections[post.passageSection];

const questions: Question[] = [
  {
    question: "What does ContentFlow read from my Google account?",
    answer: (
      <p>
        Signing in shares your name, email address and profile picture. If you connect a YouTube
        channel, ContentFlow also reads its videos, playlists and captions to make the drafts, and
        never changes anything on the channel. The{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          privacy policy
        </Link>{" "}
        has the detail.
      </p>
    ),
  },
  {
    question: "Is the transcript word for word?",
    answer: (
      <p>
        No. It comes from speech recognition and is lightly edited by AI, and every post says so at
        the top. Each heading links to its moment in the video, so a reader can hear what was said.
      </p>
    ),
  },
  {
    question: "Who can edit and approve?",
    answer: (
      <p>
        Each church has its own workspace. The owner invites admins, editors who shape the drafts,
        reviewers who approve them, and viewers who only read. A post goes out once a reviewer has
        approved it.
      </p>
    ),
  },
  {
    question: "Which websites can I post to?",
    answer: (
      <p>
        Any. Squarespace gets a one-click copy that pastes straight into a Text block. For WordPress,
        Ghost or anything else, export the post as HTML or Markdown.
      </p>
    ),
  },
  {
    question: "How do I delete my data?",
    answer: (
      <p>
        Email{" "}
        <a href="mailto:privacy@dotdasher.com" className="underline underline-offset-4">
          privacy@dotdasher.com
        </a>{" "}
        and we remove your account, its YouTube data and every post. You can also take back
        ContentFlow&apos;s access from your Google account&apos;s permissions page at any time.
      </p>
    ),
  },
];

export default function LandingPage() {
  return (
    <div className={`${literata.className} flex min-h-svh flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50`}>
      {/* The one dark band: the service as recorded and the post it becomes. */}
      <header className="bg-black text-white dark:bg-zinc-900">
        <nav className={`${FRAME} flex items-center justify-between gap-2 py-2`} aria-label="Main">
          <Link href="/" className={`${NAV_LINK} -ml-2 text-lg font-semibold`}>
            ContentFlow
          </Link>
          <div className="flex items-center gap-1 text-base">
            <Link href="/privacy" className={`${NAV_LINK} text-zinc-300 hover:text-white`}>
              Privacy
            </Link>
            <Link href="/terms" className={`${NAV_LINK} text-zinc-300 hover:text-white max-sm:hidden`}>
              Terms
            </Link>
            <Link href="/signin" className={`${NAV_LINK} -mr-2 font-medium underline-offset-4 hover:underline`}>
              Sign in
            </Link>
          </div>
        </nav>

        <div className={`${FRAME} ${GRID} pt-10 pb-12 sm:pt-20 lg:pt-16 lg:pb-20`}>
          <div className={COLUMN}>
            <h1 className="text-4xl leading-tight font-medium tracking-tight sm:text-5xl lg:text-6xl">
              {HEADLINE}
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-white lg:text-xl">{SUMMARY}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/signin"
                className="inline-flex min-h-12 items-center whitespace-nowrap bg-red-600 px-5 text-base font-medium text-white transition-colors duration-150 hover:bg-red-700 active:translate-y-px"
              >
                Sign in with Google
              </Link>
              <a
                href={ACCESS_EMAIL}
                className="inline-flex min-h-11 items-center whitespace-nowrap text-base text-zinc-300 underline underline-offset-4 transition-colors duration-150 hover:text-white"
              >
                Ask for access
              </a>
            </div>
          </div>

          <div className={`${COLUMN} mt-10 grid grid-cols-2 gap-3.5 sm:gap-8 lg:mt-14`}>
            <figure>
              <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-3/4 overflow-hidden bg-zinc-800"
              >
                <Image
                  src={service.thumbnail}
                  alt={`${service.title}, the St. John's livestream on YouTube`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 280px, 50vw"
                  className="object-cover object-left"
                />
                <span className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center bg-black text-white transition-colors duration-150 group-hover:bg-red-600">
                  <Play className="h-5 w-5" aria-hidden />
                </span>
              </a>
              <figcaption className="mt-3">
                <span className="block text-lg">The service</span>
                <span className="block text-base text-zinc-300 tabular-nums">
                  {service.shortDate} · {service.lengthInWords}
                </span>
              </figcaption>
            </figure>

            <figure>
              <div
                data-ui
                className="aspect-3/4 overflow-hidden bg-white p-3 font-sans text-zinc-950 sm:p-5 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <p className="text-base leading-snug font-semibold sm:text-xl">{post.title}</p>
                <ul className="mt-3 space-y-2 text-sm leading-snug sm:mt-5 sm:space-y-3 sm:text-base">
                  {post.sections.slice(4, 9).map((s, i) => (
                    <li key={s.heading} className={`${i < 2 ? "flex" : "hidden sm:flex"} gap-2`}>
                      <time className="w-10 shrink-0 font-medium text-blue-600 tabular-nums sm:w-12 dark:text-blue-400">
                        {s.time}
                      </time>
                      <span className="min-w-0">{s.heading}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <figcaption className="mt-3">
                <span className="block text-lg">The post</span>
                <span className="block text-base text-zinc-300 tabular-nums">
                  {post.sections.length} sections
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section aria-labelledby="states" className={`${FRAME} pt-24 lg:pt-36`}>
          <div className={GRID}>
            <h2 id="states" className={`${COLUMN} text-2xl font-medium tracking-tight sm:text-3xl`}>
              One passage, three states
            </h2>
          </div>
          <div className="mt-8 lg:mt-14">
            <PassageStates
              captionTime={post.passageTime}
              headingTime={passageSection.time}
              heading={passageSection.heading}
              caption={post.caption}
              edited={post.edited}
            />
          </div>
        </section>

        <section aria-labelledby="steps" className={`${FRAME} ${GRID} pt-24 lg:pt-36`}>
          <div className={COLUMN}>
            <h2 id="steps" className="text-2xl font-medium tracking-tight sm:text-3xl">
              From livestream to post
            </h2>
          </div>
          <ol className="mt-10 space-y-20 lg:col-span-12 lg:mt-14 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:gap-y-20 lg:space-y-0">
            <li className={COLUMN}>
              <h3 className="text-xl font-medium">First, connect the channel.</h3>
              <div data-ui className="mt-4 flex items-center gap-3 bg-zinc-100 p-4 font-sans dark:bg-zinc-900">
                <span className="min-w-0 flex-1 truncate bg-white px-3 py-2.5 text-base dark:bg-zinc-950">
                  {channel.handle}
                </span>
                <span className="shrink-0 rounded-md bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                  Connect
                </span>
              </div>
              <ul data-ui className="mt-6 space-y-3 font-sans" aria-label={`Library for ${channel.name}`}>
                {library.map((video) => (
                  <li key={video.url} className="flex items-center gap-3">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-video w-28 shrink-0 overflow-hidden bg-zinc-200 sm:w-36 dark:bg-zinc-800"
                    >
                      <Image src={video.thumbnail} alt={video.title} fill sizes="144px" className="object-cover" />
                    </a>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium">{video.title}</p>
                      <p className="text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
                        {video.date} · {video.length}
                      </p>
                    </div>
                    <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-sm whitespace-nowrap text-emerald-700 sm:inline dark:bg-emerald-900/30 dark:text-emerald-300">
                      Transcript ready
                    </span>
                  </li>
                ))}
              </ul>
            </li>

            <li className={COLUMN}>
              <h3 className="text-xl font-medium">Then open a service.</h3>
              <p className="mt-2 text-lg leading-relaxed">
                The draft arrives in the order of the service, each heading marked with its moment in
                the livestream.
              </p>
              <div data-ui className="mt-4 bg-zinc-100 p-5 font-sans dark:bg-zinc-900">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{service.title}</p>
                <p className="mt-1 text-xl font-semibold">{post.title}</p>
                <ul className="mt-4 space-y-2.5 text-base">
                  {post.sections.map((s) => (
                    <li key={s.heading} className="flex gap-3">
                      <time className="w-12 shrink-0 text-sm leading-6 font-medium text-blue-600 tabular-nums dark:text-blue-400">
                        {s.time}
                      </time>
                      <span className="min-w-0 font-medium">{s.heading}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>

            <li className={`${WIDE} lg:grid lg:grid-cols-subgrid`}>
              <div className="lg:col-span-6 lg:col-start-2">
                <h3 className="text-xl font-medium">Then copy it out.</h3>
                <p className="mt-2 text-lg leading-relaxed">
                  One button copies the approved post, headings and all, ready for a Squarespace Text
                  block.
                </p>
                <div className="mt-4">
                  <CopyPostButton text={`${passageSection.heading}\n\n${post.edited}`} />
                </div>
              </div>
              <article data-ui className="mt-6 bg-zinc-100 p-5 font-sans sm:p-8 lg:col-span-8 lg:col-start-1 dark:bg-zinc-900">
                <p className="text-2xl font-semibold tracking-tight">{post.title}</p>
                <p className="mt-4 bg-white p-4 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                  {TRANSCRIPT_DISCLAIMER}
                </p>
                <p className="mt-6 text-lg font-semibold">
                  <time className="mr-2 text-sm font-medium text-blue-600 dark:text-blue-400">{passageSection.time}</time>
                  {passageSection.heading}
                </p>
                <p className="mt-2 text-base leading-relaxed">{post.edited}</p>
              </article>
            </li>
          </ol>
        </section>

        <section className={`${FRAME} pt-24 lg:pt-36`}>
          <QuestionIndex heading="Questions" questions={questions} />
        </section>
      </main>

      <footer className={`${FRAME} ${GRID} pt-[20svh] pb-6 text-sm`}>
        <div className={`${WIDE} flex flex-col gap-2 lg:flex-row lg:items-baseline lg:justify-between`}>
          <p className="text-zinc-600 dark:text-zinc-400">Sermons into blog posts</p>
          <div className="-mx-2 flex flex-wrap">
            <Link href="/privacy" className={NAV_LINK}>
              Privacy
            </Link>
            <Link href="/terms" className={NAV_LINK}>
              Terms
            </Link>
            <a href="mailto:support@dotdasher.com" className={NAV_LINK}>
              Contact
            </a>
          </div>
          <p className="text-zinc-600 tabular-nums dark:text-zinc-400">&copy; {new Date().getFullYear()} ContentFlow</p>
        </div>
      </footer>
    </div>
  );
}
