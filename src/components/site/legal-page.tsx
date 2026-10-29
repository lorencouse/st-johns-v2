import { literata } from "./literata";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Underlined inline link for running legal text. */
export const legalLink =
  "underline decoration-zinc-400 underline-offset-2 hover:decoration-current dark:decoration-zinc-500";

/** The shared template for the privacy policy and the terms of service. */
export function LegalPage({
  title,
  updated,
  updatedIso,
  children,
}: {
  title: string;
  updated: string;
  updatedIso: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${literata.className} flex min-h-svh flex-col`}>
      <SiteHeader />
      <main className="flex-1 px-4 pt-8 pb-16 sm:px-8 sm:pt-16">
        <article className="mx-auto max-w-xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Last updated: <time dateTime={updatedIso}>{updated}</time>
          </p>
          <div className="mt-10 space-y-10 text-base leading-7 text-zinc-900 dark:text-zinc-100">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
