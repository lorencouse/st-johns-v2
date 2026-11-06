import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { contentProjects, draftVersions } from "@/server/db/schema";
import { PublishClient } from "@/components/service/publish-client";

export const dynamic = "force-dynamic";

/** Last step of a service's guided path: put the post on Squarespace. */
export default async function PublishPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; videoId: string }>;
}) {
  const { workspaceSlug, videoId } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  const [project] = await db
    .select({
      id: contentProjects.id,
      activeDraftVersionId: contentProjects.activeDraftVersionId,
      publishedAt: contentProjects.publishedAt,
      publishedUrl: contentProjects.publishedUrl,
    })
    .from(contentProjects)
    .where(
      and(
        eq(contentProjects.sourceVideoId, videoId),
        eq(contentProjects.workspaceId, workspace.id)
      )
    )
    .limit(1);

  // Nothing to publish until a post has been written.
  if (!project?.activeDraftVersionId) {
    redirect(`/w/${workspaceSlug}/services/${videoId}`);
  }

  const [draft] = await db
    .select({
      title: draftVersions.title,
      intro: draftVersions.intro,
      summary: draftVersions.summary,
    })
    .from(draftVersions)
    .where(
      and(
        eq(draftVersions.id, project.activeDraftVersionId),
        eq(draftVersions.workspaceId, workspace.id)
      )
    )
    .limit(1);

  if (!draft) redirect(`/w/${workspaceSlug}/services/${videoId}`);

  return (
    <PublishClient
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      videoId={videoId}
      projectId={project.id}
      title={draft.title}
      excerpt={(draft.summary || draft.intro || "").trim()}
      canEdit={["owner", "admin", "editor"].includes(role)}
      publishedAt={project.publishedAt?.toISOString() ?? null}
      publishedUrl={project.publishedUrl}
    />
  );
}
