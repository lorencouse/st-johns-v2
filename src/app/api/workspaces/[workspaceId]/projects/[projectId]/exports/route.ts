import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { exportArtifacts } from "@/server/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
  const { workspaceId, projectId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const artifacts = await db
    .select({
      id: exportArtifacts.id,
      format: exportArtifacts.format,
      fileName: exportArtifacts.fileName,
      mimeType: exportArtifacts.mimeType,
      bodyText: exportArtifacts.bodyText,
      createdAt: exportArtifacts.createdAt,
    })
    .from(exportArtifacts)
    .where(
      and(
        eq(exportArtifacts.contentProjectId, projectId),
        eq(exportArtifacts.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(exportArtifacts.createdAt));

  return NextResponse.json({ artifacts });
}
