import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  youtubeChannels,
  workspaceChannels,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getGoogleAccessToken } from "@/server/auth/google-token";
import { enqueueChannelSync } from "@/server/youtube/run-channel-sync";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  if (!["owner", "admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Owner-only model: syncing requires the caller's own YouTube grant.
  // Without it, the client should send the user through the OAuth flow.
  const accessToken = await getGoogleAccessToken(ctx.userId);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "YouTube is not connected for your account",
        code: "youtube_not_connected",
      },
      { status: 409 }
    );
  }

  const result = await enqueueChannelSync({
    workspaceId,
    userId: ctx.userId,
  });

  return NextResponse.json(result, { status: 202 });
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
