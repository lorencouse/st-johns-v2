"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarNavProps {
  workspaceSlug: string;
}

const navItems = [
  { label: "Library", href: "library", icon: "📚" },
  { label: "Projects", href: "projects", icon: "📝" },
  { label: "Review", href: "review", icon: "✓" },
  { label: "Settings", href: "settings/general", icon: "⚙" },
];

export function SidebarNav({ workspaceSlug }: SidebarNavProps) {
  const pathname = usePathname();
  const basePath = `/w/${workspaceSlug}`;

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const href = `${basePath}/${item.href}`;
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={item.href}
            href={href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
