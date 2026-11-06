"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheck, FileText, MonitorPlay, Settings } from "lucide-react";

interface SidebarNavProps {
  workspaceSlug: string;
}

const navItems = [
  { label: "Services", href: "library", icon: MonitorPlay },
  { label: "Posts", href: "projects", icon: FileText },
  { label: "Approvals", href: "review", icon: CircleCheck },
  { label: "Settings", href: "settings/general", icon: Settings },
];

export function SidebarNav({ workspaceSlug }: SidebarNavProps) {
  const pathname = usePathname();
  const basePath = `/w/${workspaceSlug}`;

  return (
    <nav className="flex gap-1 p-2 md:flex-col md:p-3">
      {navItems.map((item) => {
        const href = `${basePath}/${item.href}`;
        const isActive = pathname.startsWith(href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
