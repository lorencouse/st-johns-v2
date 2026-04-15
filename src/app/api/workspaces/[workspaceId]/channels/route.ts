import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember, getUserRole } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  youtubeChannels,
  workspaceChannels,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  ChannelSyncRunError,
  runChannelSyncNow,
} from "@/server/youtube/run-channel-sync";

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

  // Admin/premium users can sync external channels via API key
  const userRole = await getUserRole(ctx.userId);
  const useApiKey =
    !!channelUrl && ["admin", "premium"].includes(userRole);

  try {
    const result = await runChannelSyncNow({
      workspaceId,
      userId: ctx.userId,
      channelUrl: channelUrl || undefined,
      useApiKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ChannelSyncRunError) {
      return NextResponse.json(
        { error: error.message, runId: error.runId },
        { status: 500 }
      );
    }

    throw error;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const channels = await db
    .select({
      id: youtubeChannels.id,
      title: youtubeChannels.title,
      handle: youtubeChannels.handle,
      description: youtubeChannels.description,
      thumbnailUrl: youtubeChannels.thumbnailUrl,
      syncStatus: workspaceChannels.syncStatus,
      lastSyncedAt: workspaceChannels.lastSyncedAt,
    })
    .from(workspaceChannels)
    .innerJoin(
      youtubeChannels,
      eq(youtubeChannels.id, workspaceChannels.channelId)
    )
    .where(eq(workspaceChannels.workspaceId, workspaceId));

  return NextResponse.json(channels);
}
