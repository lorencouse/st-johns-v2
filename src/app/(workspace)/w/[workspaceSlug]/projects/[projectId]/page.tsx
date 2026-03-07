import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { contentProjects, draftVersions, sourceVideos } from "@/server/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
}) {
  const { workspaceSlug, projectId } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const [project] = await db
    .select({
      project: contentProjects,
      videoTitle: sourceVideos.title,
      videoProviderVideoId: sourceVideos.providerVideoId,
    })
    .from(contentProjects)
    .leftJoin(
      sourceVideos,
      eq(sourceVideos.id, contentProjects.sourceVideoId)
    )
    .where(
      and(
        eq(contentProjects.id, projectId),
        eq(contentProjects.workspaceId, workspace.id)
      )
    )
    .limit(1);

  if (!project) notFound();

  const drafts = await db
    .select()
    .from(draftVersions)
    .where(eq(draftVersions.contentProjectId, projectId))
    .orderBy(desc(draftVersions.versionNumber));

  const activeDraft = drafts[0];

  return (
    <div className="flex h-full">
      {/* Left rail - transcript */}
      <div className="w-80 border-r border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-500">Source</h3>
        <p className="mt-1 font-medium">{project.videoTitle}</p>
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase text-zinc-400">
            Drafts
          </h4>
          <div className="mt-2 space-y-1">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                v{draft.versionNumber} — {draft.status}
              </div>
            ))}
            {drafts.length === 0 && (
              <p className="text-sm text-zinc-400">No drafts yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Center - editor */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">{project.project.title}</h1>
          <div className="mt-2 flex gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
              {project.project.status}
            </span>
          </div>

          {activeDraft ? (
            <div className="mt-8 space-y-4">
              {activeDraft.intro && (
                <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
                  <h3 className="text-xs font-semibold uppercase text-zinc-400">
                    Intro
                  </h3>
                  <p className="mt-1 text-sm">{activeDraft.intro}</p>
                </div>
              )}
              {activeDraft.summary && (
                <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
                  <h3 className="text-xs font-semibold uppercase text-zinc-400">
                    Summary
                  </h3>
                  <p className="mt-1 text-sm">{activeDraft.summary}</p>
                </div>
              )}
              <div className="prose dark:prose-invert">
                <p className="text-sm text-zinc-500">
                  Tiptap editor will be integrated here.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-16 text-center">
              <p className="text-zinc-500">
                No draft generated yet. Run the content pipeline to create the
                first draft.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel - metadata */}
      <div className="w-72 border-l border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-500">Details</h3>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-400">Status</dt>
            <dd className="font-medium">{project.project.status}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Draft version</dt>
            <dd className="font-medium">
              {activeDraft ? `v${activeDraft.versionNumber}` : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
