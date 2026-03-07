import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  integrationConnections,
  youtubeChannels,
  appRuns,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { channelSyncQueue } from "@/server/jobs/queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  if (!["owner", "admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json();
  const { channelUrl } = body; // optional - if omitted, syncs user's own channel

  // Find or create integration connection for this workspace
  let [connection] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.workspaceId, workspaceId))
    .limit(1);

  if (!connection) {
    [connection] = await db
      .insert(integrationConnections)
      .values({
        workspaceId,
        provider: "youtube",
        status: "active",
        grantedByUserId: ctx.userId,
      })
      .returning();
  }

  // Create a run record
  const [run] = await db
    .insert(appRuns)
    .values({
      workspaceId,
      kind: "channel_sync",
      status: "queued",
      subjectType: "youtube_channel",
      triggeredByUserId: ctx.userId,
      inputJson: { channelUrl: channelUrl || null },
    })
    .returning();

  // Queue the job
  await channelSyncQueue.add("sync", {
    workspaceId,
    integrationConnectionId: connection.id,
    userId: ctx.userId,
    runId: run.id,
    channelUrl: channelUrl || undefined,
  });

  return NextResponse.json({ runId: run.id }, { status: 202 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const channels = await db
    .select()
    .from(youtubeChannels)
    .where(eq(youtubeChannels.workspaceId, workspaceId));

  return NextResponse.json(channels);
}
