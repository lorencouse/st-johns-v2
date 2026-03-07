import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { contentProjects, sourceVideos } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const projects = await db
    .select({
      project: contentProjects,
      videoTitle: sourceVideos.title,
    })
    .from(contentProjects)
    .leftJoin(
      sourceVideos,
      eq(sourceVideos.id, contentProjects.sourceVideoId)
    )
    .where(eq(contentProjects.workspaceId, workspace.id))
    .orderBy(desc(contentProjects.updatedAt))
    .limit(50);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Projects</h1>

      {projects.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-zinc-500">No projects yet.</p>
          <p className="mt-2 text-sm text-zinc-400">
            Generate a project from a video in the Library.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {projects.map(({ project, videoTitle }) => (
            <Link
              key={project.id}
              href={`/w/${workspaceSlug}/projects/${project.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div>
                <p className="font-medium">{project.title}</p>
                <p className="text-sm text-zinc-500">{videoTitle}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {project.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
