import { ServiceSteps } from "./service-steps";

/** The page layout shared by a service's guided steps. */
export function ServiceStepFrame({
  steps,
  title,
  description,
  subtitle,
  footer,
  children,
}: {
  /** Which service this is and which step is showing. */
  steps: React.ComponentProps<typeof ServiceSteps>;
  title: React.ReactNode;
  description: React.ReactNode;
  /** A quieter line under the description, cut off if it is too long. */
  subtitle?: React.ReactNode;
  /** The step's back and continue actions, kept in reach at the bottom. */
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:p-6">
        <ServiceSteps {...steps} />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-pretty text-zinc-600 dark:text-zinc-300">{description}</p>
          {subtitle && <p className="truncate text-sm text-zinc-500">{subtitle}</p>}
        </div>

        {children}
      </div>

      <div className="sticky bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 p-4 sm:px-6">
          {footer}
        </div>
      </div>
    </div>
  );
}
