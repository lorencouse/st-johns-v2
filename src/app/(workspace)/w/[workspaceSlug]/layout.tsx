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
    <div className="flex h-screen flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="flex shrink-0 flex-wrap items-center border-b border-zinc-200 md:w-60 md:flex-col md:flex-nowrap md:items-stretch md:border-r md:border-b-0 dark:border-zinc-800">
        <div className="min-w-0 flex-1 p-3 md:flex-none md:border-b md:border-zinc-200 md:p-4 md:dark:border-zinc-800">
          <h2 className="text-sm font-semibold truncate">{workspace.name}</h2>
          <p className="text-xs text-zinc-500 truncate">
            {session.user?.email}
          </p>
        </div>
        <div className="order-last w-full overflow-x-auto border-t border-zinc-200 md:order-none md:flex-1 md:overflow-x-visible md:overflow-y-auto md:border-t-0 dark:border-zinc-800">
          <SidebarNav workspaceSlug={workspaceSlug} />
        </div>
        <div className="p-3 md:border-t md:border-zinc-200 md:dark:border-zinc-800">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-left text-sm md:w-full text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
