"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsTabs = [
  { label: "General", href: "general" },
  { label: "Members", href: "members" },
  { label: "Integrations", href: "integrations" },
  { label: "Audit log", href: "audit" },
];

export function SettingsNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const basePath = `/w/${workspaceSlug}/settings`;

  return (
    <nav className="shrink-0 overflow-x-auto border-b border-zinc-200 p-2 md:w-48 md:border-r md:border-b-0 md:p-4 dark:border-zinc-800">
      <h2 className="mb-3 hidden text-xs font-semibold uppercase tracking-wider text-zinc-400 md:block">
        Settings
      </h2>
      <ul className="flex gap-1 md:flex-col">
        {settingsTabs.map((tab) => {
          const href = `${basePath}/${tab.href}`;
          const isActive = pathname.startsWith(href);
          return (
            <li key={tab.href}>
              <Link
                href={href}
                className={`block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
