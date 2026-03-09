import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { transcriptIssues } from "@/server/db/schema";
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
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

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
