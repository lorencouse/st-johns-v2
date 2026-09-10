import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { contentProjects, sourceVideos } from "@/server/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { Pagination } from "@/components/ui/pagination";
import { parsePage, parsePageSize, resolvePaging } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const pageSize = parsePageSize(pageSizeParam);

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(contentProjects)
    .where(eq(contentProjects.workspaceId, workspace.id));
  const total = totals?.total ?? 0;

  const { page, pageCount, offset } = resolvePaging(
    total,
    parsePage(pageParam),
    pageSize
  );

  const projects = await db
    .select({
      id: contentProjects.id,
      title: contentProjects.title,
      status: contentProjects.status,
      videoTitle: sourceVideos.title,
    })
    .from(contentProjects)
    .leftJoin(sourceVideos, eq(sourceVideos.id, contentProjects.sourceVideoId))
    .where(eq(contentProjects.workspaceId, workspace.id))
    // Secondary key keeps paging stable across projects touched in the same
    // batch, which share an updatedAt to the millisecond.
    .orderBy(desc(contentProjects.updatedAt), desc(contentProjects.id))
    .limit(pageSize)
    .offset(offset);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Projects</h1>

      {total === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-zinc-500">No projects yet.</p>
          <p className="mt-2 text-sm text-zinc-400">
            Generate a project from a video in the Library.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/w/${workspaceSlug}/projects/${project.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-0">
                  <p className="font-medium">{project.title}</p>
                  <p className="text-sm text-zinc-500">{project.videoTitle}</p>
                </div>
                <span className="ml-4 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                  {project.status}
                </span>
              </Link>
            ))}
          </div>

          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            label="project"
          />
        </>
      )}
    </div>
  );
}
