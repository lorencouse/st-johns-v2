import { db } from "@/server/db";
import { appRuns, integrationConnections } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  handleChannelSync,
  type ChannelSyncPayload,
} from "@/server/jobs/handlers/channel-sync";

interface RunChannelSyncNowInput {
  workspaceId: string;
  userId: string;
  channelUrl?: string;
  useApiKey?: boolean;
  inputJson?: Record<string, unknown>;
}

export class ChannelSyncRunError extends Error {
  constructor(
    message: string,
    readonly runId: string
  ) {
    super(message);
    this.name = "ChannelSyncRunError";
  }
}

export async function runChannelSyncNow({
  workspaceId,
  userId,
  channelUrl,
  useApiKey,
  inputJson,
}: RunChannelSyncNowInput) {
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
  }

  const [run] = await db
    .insert(appRuns)
    .values({
      workspaceId,
      kind: "channel_sync",
      status: "queued",
      subjectType: "youtube_channel",
      triggeredByUserId: userId,
      inputJson: {
        channelUrl: channelUrl || null,
        ...(inputJson ?? {}),
      },
    })
    .returning();

  const payload: ChannelSyncPayload = {
    workspaceId,
    integrationConnectionId: connection.id,
    userId,
    runId: run.id,
    channelUrl,
    useApiKey,
  };

  try {
    await handleChannelSync(payload);
  } catch (error) {
    throw new ChannelSyncRunError(
      error instanceof Error ? error.message : "Channel sync failed",
      run.id
    );
  }

  return { runId: run.id };
}
