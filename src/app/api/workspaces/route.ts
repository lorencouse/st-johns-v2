import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  workspaces,
  workspaceMembers,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getGoogleAccessToken } from "@/server/auth/google-token";
import { enqueueChannelSync } from "@/server/youtube/run-channel-sync";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json(
      { error: "Name and slug are required" },
      { status: 400 }
    );
  }

  // Check slug uniqueness
  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "A workspace with that URL already exists" },
      { status: 409 }
    );
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name,
      slug,
      createdByUserId: session.user.id,
    })
    .returning();

  // Add creator as owner
  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: session.user.id,
    role: "owner",
    createdByUserId: session.user.id,
  });

  // Auto-connect YouTube when the current account already has the needed scope.
  let syncRunId: string | null = null;
  try {
    const accessToken = await getGoogleAccessToken(session.user.id);
    if (accessToken) {
      const result = await enqueueChannelSync({
        workspaceId: workspace.id,
        userId: session.user.id,
        inputJson: { autoTriggered: true, workspaceCreated: true },
      });
      syncRunId = result.runId;
    }
  } catch (err) {
    // Don't fail workspace creation if YouTube sync can't be enqueued yet.
    console.error("[workspace] Failed to auto-connect YouTube:", err);
  }

  return NextResponse.json({ ...workspace, syncRunId }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, session.user.id));

  return NextResponse.json(result);
}
