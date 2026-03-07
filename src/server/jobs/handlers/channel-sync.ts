import { db } from "@/server/db";
import {
  youtubeChannels,
  youtubePlaylists,
  sourceVideos,
  playlistVideos,
  integrationConnections,
  appRuns,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getGoogleAccessToken } from "@/server/auth/google-token";
import {
  fetchMyChannel,
  resolveChannel,
  fetchChannelPlaylists,
  fetchPlaylistVideos,
  fetchVideoDetails,
} from "@/server/youtube/api";

export interface ChannelSyncPayload {
  workspaceId: string;
  integrationConnectionId: string;
  userId: string;
  runId: string;
  channelUrl?: string; // If omitted, fetches user's own channel
}

export async function handleChannelSync(payload: ChannelSyncPayload) {
  const { workspaceId, integrationConnectionId, userId, runId, channelUrl } =
    payload;

  // Mark run as running
  await db
    .update(appRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(appRuns.id, runId));

  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) {
      throw new Error("No valid Google access token. Please re-authenticate.");
    }

    // 1. Resolve channel
    console.log(`[channel-sync] Resolving channel for run ${runId}`);
    const channelInfo = channelUrl
      ? await resolveChannel(channelUrl, accessToken)
      : await fetchMyChannel(accessToken);

    // 2. Upsert channel
    const [channel] = await db
      .insert(youtubeChannels)
      .values({
        workspaceId,
        integrationConnectionId,
        providerChannelId: channelInfo.youtubeId,
        title: channelInfo.title,
        description: channelInfo.description,
        handle: channelInfo.handle,
        thumbnailUrl: channelInfo.thumbnailUrl,
        uploadsPlaylistProviderId: channelInfo.uploadsPlaylistId,
        syncStatus: "syncing",
      })
      .onConflictDoUpdate({
        target: [youtubeChannels.workspaceId, youtubeChannels.providerChannelId],
        set: {
          title: channelInfo.title,
          description: channelInfo.description,
          handle: channelInfo.handle,
          thumbnailUrl: channelInfo.thumbnailUrl,
          uploadsPlaylistProviderId: channelInfo.uploadsPlaylistId,
          syncStatus: "syncing",
          updatedAt: new Date(),
        },
      })
      .returning();

    // 3. Fetch and upsert playlists
    console.log(`[channel-sync] Fetching playlists for ${channelInfo.title}`);
    const playlists = await fetchChannelPlaylists(
      channelInfo.youtubeId,
      accessToken
    );

    // Add uploads playlist if available
    if (channelInfo.uploadsPlaylistId) {
      const hasUploads = playlists.some(
        (p) => p.youtubeId === channelInfo.uploadsPlaylistId
      );
      if (!hasUploads) {
        playlists.unshift({
          youtubeId: channelInfo.uploadsPlaylistId,
          title: "All Videos",
          description: null,
          thumbnailUrl: null,
          itemCount: 0,
        });
      }
    }

    for (const pl of playlists) {
      const isUploads = pl.youtubeId === channelInfo.uploadsPlaylistId;
      await db
        .insert(youtubePlaylists)
        .values({
          workspaceId,
          channelId: channel.id,
          providerPlaylistId: pl.youtubeId,
          kind: isUploads ? "uploads" : "standard",
          title: pl.title,
          description: pl.description,
          itemCount: pl.itemCount,
          thumbnailUrl: pl.thumbnailUrl,
        })
        .onConflictDoUpdate({
          target: [
            youtubePlaylists.workspaceId,
            youtubePlaylists.providerPlaylistId,
          ],
          set: {
            title: pl.title,
            description: pl.description,
            itemCount: pl.itemCount,
            thumbnailUrl: pl.thumbnailUrl,
            updatedAt: new Date(),
          },
        });
    }

    // 4. Fetch videos from uploads playlist
    if (channelInfo.uploadsPlaylistId) {
      console.log(`[channel-sync] Fetching videos from uploads playlist`);
      const videos = await fetchPlaylistVideos(
        channelInfo.uploadsPlaylistId,
        accessToken
      );

      // Fetch video details (duration, published date) in batches
      const videoIds = videos.map((v) => v.youtubeId);
      const details = await fetchVideoDetails(videoIds, accessToken);

      // Get the uploads playlist DB record
      const [uploadsPlaylist] = await db
        .select()
        .from(youtubePlaylists)
        .where(
          and(
            eq(youtubePlaylists.workspaceId, workspaceId),
            eq(
              youtubePlaylists.providerPlaylistId,
              channelInfo.uploadsPlaylistId
            )
          )
        )
        .limit(1);

      for (const video of videos) {
        const detail = details.get(video.youtubeId);
        const [upsertedVideo] = await db
          .insert(sourceVideos)
          .values({
            workspaceId,
            channelId: channel.id,
            providerVideoId: video.youtubeId,
            title: video.title,
            description: detail?.description ?? video.description,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt: detail?.publishedAt
              ? new Date(detail.publishedAt)
              : video.publishedAt
                ? new Date(video.publishedAt)
                : null,
            durationSeconds: detail?.durationSeconds ?? null,
            ingestStatus: "metadata_synced",
            lastMetadataSyncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [sourceVideos.workspaceId, sourceVideos.providerVideoId],
            set: {
              title: video.title,
              description: detail?.description ?? video.description,
              thumbnailUrl: video.thumbnailUrl,
              publishedAt: detail?.publishedAt
                ? new Date(detail.publishedAt)
                : undefined,
              durationSeconds: detail?.durationSeconds ?? undefined,
              lastMetadataSyncedAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();

        // Link video to uploads playlist
        if (uploadsPlaylist) {
          await db
            .insert(playlistVideos)
            .values({
              playlistId: uploadsPlaylist.id,
              videoId: upsertedVideo.id,
              position: video.position,
            })
            .onConflictDoNothing();
        }
      }

      console.log(
        `[channel-sync] Synced ${videos.length} videos for ${channelInfo.title}`
      );
    }

    // 5. Mark channel as synced
    await db
      .update(youtubeChannels)
      .set({ syncStatus: "ok", lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(youtubeChannels.id, channel.id));

    // 6. Mark run as succeeded
    await db
      .update(appRuns)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        outputJson: {
          channelId: channel.id,
          channelTitle: channelInfo.title,
          playlistCount: playlists.length,
        },
      })
      .where(eq(appRuns.id, runId));

    console.log(`[channel-sync] Completed run ${runId}`);
  } catch (error) {
    console.error(`[channel-sync] Failed run ${runId}:`, error);

    await db
      .update(appRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(appRuns.id, runId));

    throw error;
  }
}
