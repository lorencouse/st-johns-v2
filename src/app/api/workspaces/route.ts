import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  workspaces,
  workspaceMembers,
  integrationConnections,
  appRuns,
} from "@/server/db/schema";
import { channelSyncQueue } from "@/server/jobs/queue";
import { eq } from "drizzle-orm";

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

  // Auto-connect YouTube: create integration and queue channel sync
  try {
    const [connection] = await db
      .insert(integrationConnections)
      .values({
        workspaceId: workspace.id,
        provider: "youtube",
        status: "active",
        grantedByUserId: session.user.id,
      })
      .returning();

    const [run] = await db
      .insert(appRuns)
      .values({
        workspaceId: workspace.id,
        kind: "channel_sync",
        status: "queued",
        subjectType: "youtube_channel",
        triggeredByUserId: session.user.id,
        inputJson: { channelUrl: null },
      })
      .returning();

    await channelSyncQueue.add("sync", {
      workspaceId: workspace.id,
      integrationConnectionId: connection.id,
      userId: session.user.id,
      runId: run.id,
    });
  } catch (err) {
    // Don't fail workspace creation if YouTube sync fails to queue
    console.error("[workspace] Failed to auto-connect YouTube:", err);
  }

  return NextResponse.json(workspace, { status: 201 });
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
