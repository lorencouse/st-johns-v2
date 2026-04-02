import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { transcriptIssues, transcriptRevisions } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

// Resolve an issue
export async function PATCH(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      workspaceId: string;
      videoId: string;
      issueId: string;
    }>;
  }
) {
  const { workspaceId, issueId } = await params;
  const { videoId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const [issue] = await db
    .select({ id: transcriptIssues.id })
    .from(transcriptIssues)
    .innerJoin(
      transcriptRevisions,
      eq(transcriptRevisions.id, transcriptIssues.revisionId)
    )
    .where(
      and(
        eq(transcriptIssues.id, issueId),
        eq(transcriptIssues.workspaceId, workspaceId),
        eq(transcriptRevisions.videoId, videoId)
      )
    )
    .limit(1);

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  await db
    .update(transcriptIssues)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      resolvedByUserId: ctx.userId,
    })
    .where(
      and(
        eq(transcriptIssues.id, issueId),
        eq(transcriptIssues.workspaceId, workspaceId)
      )
    );

  return NextResponse.json({ ok: true });
}
