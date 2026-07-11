import { db } from "@/server/db";
import { appRuns, integrationConnections } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { channelSyncQueue } from "@/server/jobs/queue";
import { findActiveRun } from "@/server/jobs/runs";
import type { ChannelSyncPayload } from "@/server/jobs/handlers/channel-sync";

interface EnqueueChannelSyncInput {
  workspaceId: string;
  userId: string;
  inputJson?: Record<string, unknown>;
}

/**
 * Enqueue a background sync of the user's own YouTube channel. Returns the
 * run to poll. If a sync is already queued/running for the workspace, attaches
 * to it instead of enqueueing a duplicate.
 */
export async function enqueueChannelSync({
  workspaceId,
  userId,
  inputJson,
}: EnqueueChannelSyncInput) {
  const active = await findActiveRun(workspaceId, "channel_sync", null);
  if (active) {
    return { runId: active.id };
  }

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
        grantedByUserId: userId,
      })
      .returning();
  } else if (connection.status !== "active") {
    // A sync is only enqueued when the caller holds a valid token, so the
    // connection is usable again.
    await db
      .update(integrationConnections)
      .set({ status: "active", grantedByUserId: userId })
      .where(eq(integrationConnections.id, connection.id));
  }

  const [run] = await db
    .insert(appRuns)
    .values({
      workspaceId,
      kind: "channel_sync",
      status: "queued",
      subjectType: "youtube_channel",
      triggeredByUserId: userId,
      inputJson: inputJson ?? {},
    })
    .returning();

  const payload: ChannelSyncPayload = {
    workspaceId,
    integrationConnectionId: connection.id,
    userId,
    runId: run.id,
  };
  await channelSyncQueue.add("sync", payload);

  return { runId: run.id };
}
