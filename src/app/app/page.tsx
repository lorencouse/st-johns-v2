import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { asc, eq } from "drizzle-orm";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const memberships = await db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, session.user.id))
    .orderBy(asc(workspaces.name));

  if (memberships.length === 1) {
    redirect(`/w/${memberships[0].workspace.slug}/library`);
  }

  if (memberships.length === 0) {
    redirect("/app/new-workspace");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.12),_transparent_28%),linear-gradient(180deg,_#fafafa,_#f4f4f5)] px-6 py-12 dark:bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.16),_transparent_28%),linear-gradient(180deg,_#09090b,_#111827)]">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">
              Workspace hub
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Choose where you want to work
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Pick a workspace to continue editing, reviewing, or syncing your
              video library. Use separate workspaces for different teams or
              publishing brands.
            </p>
          </div>

          <Link
            href="/app/new-workspace"
            className="inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create workspace
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {memberships.map(({ workspace, role }) => (
            <Link
              key={workspace.id}
              href={`/w/${workspace.slug}/library`}
              className="group rounded-[26px] border border-zinc-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/90 dark:hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {workspace.name}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    /w/{workspace.slug}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {role}
                </span>
              </div>

              <div className="mt-8 flex items-center justify-between text-sm">
                <div className="text-zinc-500">
                  <p>Timezone</p>
                  <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                    {workspace.timezone}
                  </p>
                </div>
                <span className="font-medium text-zinc-900 transition group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
                  Open workspace →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
