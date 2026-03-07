import { requireWorkspaceMember } from "@/lib/workspace";
import { SidebarNav } from "@/components/workspace/sidebar-nav";
import { signOut } from "@/server/auth";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace, session } = await requireWorkspaceMember(workspaceSlug);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold truncate">{workspace.name}</h2>
          <p className="text-xs text-zinc-500 truncate">
            {session.user?.email}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav workspaceSlug={workspaceSlug} />
        </div>
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
