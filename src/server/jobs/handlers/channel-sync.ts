import { db } from "@/server/db";
import {
  youtubeChannels,
  youtubePlaylists,
  sourceVideos,
  playlistVideos,
  workspaceChannels,
  workspaceVideos,
  workspacePlaylists,
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
  type YTAuth,
} from "@/server/youtube/api";

export interface ChannelSyncPayload {
  workspaceId: string;
  integrationConnectionId: string;
  userId: string;
  runId: string;
  channelUrl?: string; // If omitted, fetches user's own channel
  useApiKey?: boolean; // If true, use YouTube API key instead of OAuth
}

export async function handleChannelSync(payload: ChannelSyncPayload) {
  const {
    workspaceId,
    integrationConnectionId,
    userId,
    runId,
    channelUrl,
    useApiKey,
  } = payload;

  // Mark run as running
  await db
    .update(appRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(appRuns.id, runId));

  try {
    const [connection] = await db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.id, integrationConnectionId),
          eq(integrationConnections.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!connection) {
      throw new Error("Integration connection not found for workspace");
    }

    // Determine auth method: API key for external channels, OAuth for own channel
    let auth: YTAuth;
    if (useApiKey && channelUrl) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error("YOUTUBE_API_KEY not configured");
      }
      auth = { apiKey };
      console.log(`[channel-sync] Using API key for external channel sync`);
    } else {
      const accessToken = await getGoogleAccessToken(userId);
      if (!accessToken) {
        throw new Error(
          "No valid Google access token. Please re-authenticate."
        );
      }
      auth = accessToken;
    }

    // 1. Resolve channel
    console.log(`[channel-sync] Resolving channel for run ${runId}`);
    const channelInfo = channelUrl
      ? await resolveChannel(channelUrl, auth)
      : await fetchMyChannel(auth as string);

    // 2. Upsert global channel record
    await db
      .insert(youtubeChannels)
      .values({
        id: channelInfo.youtubeId,
        title: channelInfo.title,
        description: channelInfo.description,
        handle: channelInfo.handle,
        thumbnailUrl: channelInfo.thumbnailUrl,
        uploadsPlaylistProviderId: channelInfo.uploadsPlaylistId,
      })
      .onConflictDoUpdate({
        target: youtubeChannels.id,
        set: {
          title: channelInfo.title,
          description: channelInfo.description,
          handle: channelInfo.handle,
          thumbnailUrl: channelInfo.thumbnailUrl,
          uploadsPlaylistProviderId: channelInfo.uploadsPlaylistId,
          updatedAt: new Date(),
        },
      });

    // 3. Upsert workspace ↔ channel junction
    await db
      .insert(workspaceChannels)
      .values({
        workspaceId,
        channelId: channelInfo.youtubeId,
        integrationConnectionId,
        syncStatus: "syncing",
        addedByUserId: userId,
      })
      .onConflictDoUpdate({
        target: [workspaceChannels.workspaceId, workspaceChannels.channelId],
        set: {
          integrationConnectionId,
          syncStatus: "syncing",
        },
      });

    // 4. Fetch and upsert playlists
    console.log(`[channel-sync] Fetching playlists for ${channelInfo.title}`);
    const playlists = await fetchChannelPlaylists(
      channelInfo.youtubeId,
      auth
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

      // Upsert global playlist
      await db
        .insert(youtubePlaylists)
        .values({
          id: pl.youtubeId,
          channelId: channelInfo.youtubeId,
          kind: isUploads ? "uploads" : "standard",
          title: pl.title,
          description: pl.description,
          itemCount: pl.itemCount,
          thumbnailUrl: pl.thumbnailUrl,
        })
        .onConflictDoUpdate({
          target: youtubePlaylists.id,
          set: {
            title: pl.title,
            description: pl.description,
            itemCount: pl.itemCount,
            thumbnailUrl: pl.thumbnailUrl,
            updatedAt: new Date(),
          },
        });

      // Upsert workspace ↔ playlist junction
      await db
        .insert(workspacePlaylists)
        .values({
          workspaceId,
          playlistId: pl.youtubeId,
          addedByUserId: userId,
        })
        .onConflictDoNothing();
    }

    // 5. Fetch videos from uploads playlist
    if (channelInfo.uploadsPlaylistId) {
      console.log(`[channel-sync] Fetching videos from uploads playlist`);
      const videos = await fetchPlaylistVideos(
        channelInfo.uploadsPlaylistId,
        auth
      );

      // Fetch video details (duration, published date) in batches
      const videoIds = videos.map((v) => v.youtubeId);
      const details = await fetchVideoDetails(videoIds, auth);

      for (const video of videos) {
        const detail = details.get(video.youtubeId);

        // Upsert global video
        await db
          .insert(sourceVideos)
          .values({
            id: video.youtubeId,
            channelId: channelInfo.youtubeId,
            title: video.title,
            description: detail?.description ?? video.description,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt: detail?.publishedAt
              ? new Date(detail.publishedAt)
              : video.publishedAt
                ? new Date(video.publishedAt)
                : null,
            durationSeconds: detail?.durationSeconds ?? null,
            lastMetadataSyncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: sourceVideos.id,
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
          });

        // Upsert workspace ↔ video junction
        await db
          .insert(workspaceVideos)
          .values({
            workspaceId,
            videoId: video.youtubeId,
            ingestStatus: "metadata_synced",
            addedByUserId: userId,
          })
          .onConflictDoNothing();

        // Link video to uploads playlist
        await db
          .insert(playlistVideos)
          .values({
            playlistId: channelInfo.uploadsPlaylistId,
            videoId: video.youtubeId,
            position: video.position,
          })
          .onConflictDoNothing();
      }

      console.log(
        `[channel-sync] Synced ${videos.length} videos for ${channelInfo.title}`
      );
    }

    // 6. Mark channel as synced (on junction table)
    await db
      .update(workspaceChannels)
      .set({ syncStatus: "ok", lastSyncedAt: new Date() })
      .where(
        and(
          eq(workspaceChannels.workspaceId, workspaceId),
          eq(workspaceChannels.channelId, channelInfo.youtubeId)
        )
      );

    // 7. Mark run as succeeded
    await db
      .update(appRuns)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        outputJson: {
          channelId: channelInfo.youtubeId,
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
