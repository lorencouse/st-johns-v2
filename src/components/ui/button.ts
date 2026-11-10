/** Shared button looks, for `<button>` and for links styled as buttons. */
export const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium disabled:opacity-50";

export const buttonSecondary = `${buttonBase} border border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900`;

export const buttonDone = `${buttonBase} border border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300`;

/** The main action of a step: larger, and it fills the footer on phones. */
export const buttonStepPrimary =
  "inline-flex min-h-12 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-6 text-base font-semibold text-white hover:bg-blue-700 sm:flex-none";

/** The way back out of a step, beside its main action. */
export const buttonStepBack =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";
