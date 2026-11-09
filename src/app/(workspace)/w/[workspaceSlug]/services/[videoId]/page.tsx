import { notFound } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/workspace";
import { loadServiceContext } from "@/server/services/queries";
import { isNotAired } from "@/lib/status-labels";
import { CheckVideoClient } from "@/components/service/check-video-client";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Step 1 of a service's guided path: confirm the video and get its captions. */
export default async function ServicePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; videoId: string }>;
}) {
  const { workspaceSlug, videoId } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  const row = await loadServiceContext(workspace.id, videoId);
  if (!row) notFound();

  return (
    <CheckVideoClient
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      videoId={videoId}
      title={row.title}
      thumbnailUrl={row.thumbnailUrl}
      publishedAt={row.publishedAt?.toISOString() ?? null}
      captionsReady={row.captionsReady}
      captionsFailed={row.ingestStatus === "ingest_failed"}
      notAiredYet={isNotAired(row.liveStatus)}
      canEdit={can(role, "edit")}
      projectId={row.projectId}
    />
  );
}
