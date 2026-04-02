import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { appRuns, workspaceMembers } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = await params;
  const [result] = await db
    .select({ run: appRuns })
    .from(appRuns)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, appRuns.workspaceId),
        eq(workspaceMembers.userId, session.user.id)
      )
    )
    .where(eq(appRuns.id, runId))
    .limit(1);

  if (!result) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(result.run);
}
