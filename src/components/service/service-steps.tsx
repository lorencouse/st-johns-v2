import Link from "next/link";
import { Check } from "lucide-react";
import {
  SERVICE_STEPS,
  serviceStepHref,
  type ServiceStepKey,
} from "@/lib/service-steps";

interface ServiceStepsProps {
  workspaceSlug: string;
  videoId: string;
  projectId: string | null;
  canEdit: boolean;
  current: ServiceStepKey;
}

/**
 * Progress bar for one service's guided path. Finished steps link back so
 * people can revisit them; on a phone it collapses to "Step 2 of 5".
 */
export function ServiceSteps({
  workspaceSlug,
  videoId,
  projectId,
  canEdit,
  current,
}: ServiceStepsProps) {
  const currentIndex = SERVICE_STEPS.findIndex((s) => s.key === current);
  const total = SERVICE_STEPS.length;

  return (
    <nav aria-label="Progress" className="w-full">
      <p className="mb-2 text-sm text-zinc-600 sm:hidden dark:text-zinc-300">
        Step {currentIndex + 1} of {total} · {SERVICE_STEPS[currentIndex].label}
      </p>
      <ol className="flex gap-1.5 sm:gap-2">
        {SERVICE_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const isCurrent = index === currentIndex;
          const href = done
            ? serviceStepHref(workspaceSlug, videoId, step.key, { projectId, canEdit })
            : null;
          const bar = done || isCurrent ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-800";
          const text = isCurrent
            ? "font-semibold text-zinc-900 dark:text-zinc-100"
            : done
              ? "text-zinc-600 dark:text-zinc-300"
              : "text-zinc-500 dark:text-zinc-400";
          const label = (
            <>
              <span className={`block h-1 rounded-full ${bar}`} aria-hidden="true" />
              <span className={`mt-2 hidden items-center gap-1 text-sm sm:flex ${text}`}>
                {done ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
                ) : (
                  <span className="tabular-nums">{index + 1}.</span>
                )}
                <span className="min-w-0 truncate">{step.label}</span>
              </span>
            </>
          );
          return (
            <li
              key={step.key}
              className="min-w-0 flex-1"
              aria-current={isCurrent ? "step" : undefined}
            >
              {href ? (
                <Link href={href} className="block rounded hover:opacity-80">
                  {label}
                  <span className="sr-only sm:hidden">{step.label}</span>
                </Link>
              ) : (
                <>
                  {label}
                  <span className="sr-only sm:hidden">{step.label}</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
