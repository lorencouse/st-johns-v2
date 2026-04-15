import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  sourceVideos,
  workspaceChannels,
  workspacePlaylists,
  workspaceVideos,
  youtubePlaylists,
} from "@/server/db/schema";

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ workspaceId: string; channelId: string }>;
  }
) {
  const { workspaceId, channelId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  if (!["owner", "admin"].includes(ctx.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  const [channel] = await db
    .select({ id: workspaceChannels.channelId })
    .from(workspaceChannels)
    .where(
      and(
        eq(workspaceChannels.workspaceId, workspaceId),
        eq(workspaceChannels.channelId, channelId)
      )
    )
    .limit(1);

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const [playlistRows, videoRows] = await Promise.all([
    db
      .select({ id: youtubePlaylists.id })
      .from(youtubePlaylists)
      .where(eq(youtubePlaylists.channelId, channelId)),
    db
      .select({ id: sourceVideos.id })
      .from(sourceVideos)
      .where(eq(sourceVideos.channelId, channelId)),
  ]);

  const playlistIds = playlistRows.map((playlist) => playlist.id);
  const videoIds = videoRows.map((video) => video.id);

  await db.transaction(async (tx) => {
    if (playlistIds.length > 0) {
      await tx
        .delete(workspacePlaylists)
        .where(
          and(
            eq(workspacePlaylists.workspaceId, workspaceId),
            inArray(workspacePlaylists.playlistId, playlistIds)
          )
        );
    }

    if (videoIds.length > 0) {
      await tx
        .delete(workspaceVideos)
        .where(
          and(
            eq(workspaceVideos.workspaceId, workspaceId),
            inArray(workspaceVideos.videoId, videoIds)
          )
        );
    }

    await tx
      .delete(workspaceChannels)
      .where(
        and(
          eq(workspaceChannels.workspaceId, workspaceId),
          eq(workspaceChannels.channelId, channelId)
        )
      );
  });

  return NextResponse.json({ ok: true });
}
