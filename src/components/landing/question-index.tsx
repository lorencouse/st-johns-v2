"use client";

import { useId, useState } from "react";

export interface Question {
  question: string;
  answer: React.ReactNode;
}

/**
 * Questions with one answer open at a time. On a phone the answer opens under
 * its question; on a wide screen the questions sit on the left and the open
 * answer is set large in a pane beside them.
 */
export function QuestionIndex({ heading, questions }: { heading: string; questions: Question[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();
  const shown = open ?? 0;

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
      <div className="lg:col-span-3 lg:col-start-4">
        <h2 id={`${id}-heading`} className="text-2xl font-medium tracking-tight sm:text-3xl">
          {heading}
        </h2>
        <ul className="mt-6 space-y-1" aria-labelledby={`${id}-heading`}>
          {questions.map((q, i) => {
            const isOpen = open === i;
            return (
              <li key={q.question}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${id}-answer-${i}`}
                  onClick={() => setOpen(isOpen && !isWide() ? null : i)}
                  onMouseEnter={() => isWide() && setOpen(i)}
                  className={`group flex min-h-11 w-full items-start gap-3 py-2 text-left text-lg whitespace-normal transition-colors duration-150 ${
                    isOpen ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-2.5 h-2 w-2 shrink-0 rounded-full transition-colors duration-150 ${
                      isOpen ? "bg-zinc-950 dark:bg-zinc-50" : "bg-zinc-400 dark:bg-zinc-600"
                    }`}
                  />
                  <span className="min-w-0">{q.question}</span>
                </button>
                <div
                  id={`${id}-answer-${i}`}
                  hidden={!isOpen}
                  className="pb-4 pl-5 text-lg leading-relaxed lg:hidden"
                >
                  {q.answer}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="hidden lg:col-span-4 lg:col-start-7 lg:block">
        <div aria-live="polite" className="sticky top-28 pt-16 text-2xl leading-snug">
          {questions[shown].answer}
        </div>
      </div>
    </div>
  );
}

/** The width at which the open answer moves into the pane beside the list. */
function isWide() {
  return window.matchMedia("(min-width: 64rem)").matches;
}
