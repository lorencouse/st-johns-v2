import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { serviceDocuments } from "@/server/db/schema";
import { documentSummary } from "@/server/documents/summary";
import { loadServiceContext } from "@/server/services/queries";
import { isStorageConfigured } from "@/server/storage/r2";
import { DocumentsClient } from "@/components/service/documents-client";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Optional step: attach the sermon, the bulletin, or anything else. */
export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; videoId: string }>;
}) {
  const { workspaceSlug, videoId } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  if (!can(role, "edit")) {
    redirect(`/w/${workspaceSlug}/services/${videoId}`);
  }

  const row = await loadServiceContext(workspace.id, videoId);
  if (!row) notFound();

  const documents = await db
    .select(documentSummary)
    .from(serviceDocuments)
    .where(
      and(
        eq(serviceDocuments.workspaceId, workspace.id),
        eq(serviceDocuments.sourceVideoId, videoId)
      )
    )
    .orderBy(asc(serviceDocuments.createdAt));

  return (
    <DocumentsClient
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      videoId={videoId}
      videoTitle={row.title}
      projectId={row.projectId}
      captionsReady={row.captionsReady}
      storageReady={isStorageConfigured()}
      initialDocuments={documents.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
