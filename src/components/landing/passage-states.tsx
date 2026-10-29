"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { CaptionRun } from "@/app/landing-service";
import { MomentLink } from "@/components/landing/moment-link";

interface PassageStatesProps {
  captionTime: string;
  headingTime: string;
  heading: string;
  caption: CaptionRun[];
  edited: string;
}

/**
 * One passage of a service in its three states: the raw YouTube caption, the
 * edit ContentFlow makes of it, and the reviewer's approval. The edited copy
 * is live: its switch flips back to the caption, and Approve works.
 */
export function PassageStates({ captionTime, headingTime, heading, caption, edited }: PassageStatesProps) {
  const [view, setView] = useState<"caption" | "edited">("edited");
  const [approved, setApproved] = useState(false);

  return (
    <ol className="space-y-12 lg:space-y-14">
      <State word="As captioned">
        <div data-ui className="flex gap-4 bg-zinc-100 p-5 font-sans dark:bg-zinc-900">
          <MomentLink time={captionTime} className="-m-3 shrink-0 p-3 pt-3.5 text-sm font-medium text-blue-600 tabular-nums underline-offset-4 hover:underline dark:text-blue-400">
            <time>{captionTime}</time>
          </MomentLink>
          <CaptionText runs={caption} />
        </div>
      </State>

      <State word="As edited">
        <div data-ui className="bg-zinc-100 p-5 font-sans dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-base font-semibold">
              <MomentLink time={headingTime} className="block py-2.5 underline-offset-4 hover:underline">
                <time className="mr-2 text-sm font-medium text-blue-600 tabular-nums dark:text-blue-400">{headingTime}</time>
                {heading}
              </MomentLink>
            </p>
            <div role="group" aria-label="Show the passage as" className="flex rounded-md bg-zinc-200 p-0.5 text-sm dark:bg-zinc-800">
              {(["caption", "edited"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`min-h-11 rounded px-3 font-medium transition-colors duration-150 ${
                    view === v
                      ? "bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50"
                      : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  }`}
                >
                  {v === "caption" ? "Caption" : "Edited"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 min-h-36 sm:min-h-24" aria-live="polite">
            {view === "edited" ? <p className="text-base leading-relaxed">{edited}</p> : <CaptionText runs={caption} />}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{approved ? "Approved" : "In review"}</span>
            <button
              type="button"
              onClick={() => setApproved((a) => !a)}
              className={`min-h-11 rounded-md px-4 text-sm font-medium transition-colors duration-150 active:translate-y-px ${
                approved
                  ? "bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              }`}
            >
              {approved ? "Undo approval" : "Approve"}
            </button>
          </div>
        </div>
      </State>

      <State word="Approved">
        <div data-ui className="flex min-h-16 items-center gap-3 bg-zinc-100 p-5 font-sans dark:bg-zinc-900" aria-live="polite">
          {approved ? (
            <>
              <Check className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-base font-medium">Approved by the reviewer, ready to post</p>
            </>
          ) : (
            <p className="text-base text-zinc-600 dark:text-zinc-400">Waiting for a reviewer to approve</p>
          )}
        </div>
      </State>
    </ol>
  );
}

function State({ word, children }: { word: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col-reverse gap-2.5 lg:grid lg:grid-cols-12 lg:gap-x-8">
      <p className="text-lg text-zinc-600 lg:col-span-3 lg:pt-4 lg:text-right lg:text-xl dark:text-zinc-400">{word}</p>
      <div className="lg:col-span-6">{children}</div>
    </li>
  );
}

function CaptionText({ runs }: { runs: CaptionRun[] }) {
  return (
    <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
      {runs.map((run, i) =>
        run.dropped ? (
          <span key={i} className="underline decoration-amber-500 decoration-wavy decoration-2 underline-offset-4">
            {run.text}
          </span>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </p>
  );
}
