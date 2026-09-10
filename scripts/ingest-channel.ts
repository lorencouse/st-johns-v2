/**
 * Batch-ingest transcripts for a public YouTube channel.
 *
 * Lists videos through the YouTube Data API (public, API-key only) and pulls
 * each caption track with yt-dlp, so it works on channels we do not own.
 *
 *   bun run scripts/ingest-channel.ts --channel https://www.youtube.com/@stjohnssf --limit 10
 *
 * Flags:
 *   --channel <url>      Channel to ingest (required)
 *   --workspace <slug>   Workspace slug to load into      (default: st-johns)
 *   --owner <email>      Service user, created if missing (default: importer@st-johns.local)
 *   --limit <n>          Max videos to transcribe this run (default: 10)
 *   --min-duration <s>   Skip videos shorter than this     (default: 600)
 *   --playlists          Also record the channel's playlists
 *   --local              Transcribe caption-less videos with local whisper.cpp (free)
 *   --whisper            Allow the PAID Whisper API fallback instead
 *   --redo               Re-ingest videos that already have a transcript
 */
import { db } from "@/server/db";
import {
  users,
  workspaces,
  workspaceMembers,
  integrationConnections,
  youtubeChannels,
  youtubePlaylists,
  workspacePlaylists,
  sourceVideos,
  workspaceChannels,
  workspaceVideos,
  transcriptRevisions,
  appRuns,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import {
  resolveChannel,
  fetchPlaylistVideos,
  fetchVideoDetails,
  fetchChannelPlaylists,
} from "@/server/youtube/api";
import { handleVideoIngest } from "@/server/jobs/handlers/video-ingest";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const CHANNEL_URL = arg("channel");
const WORKSPACE_SLUG = arg("workspace", "st-johns")!;
const OWNER_EMAIL = arg("owner", "importer@st-johns.local")!;
const LIMIT = parseInt(arg("limit", "10")!, 10);
const MIN_DURATION = parseInt(arg("min-duration", "600")!, 10);

if (!CHANNEL_URL) {
  console.error("Missing --channel <url>");
  process.exit(1);
}

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error("YOUTUBE_API_KEY is not set in .env");
  process.exit(1);
}
const auth = { apiKey };

/**
 * The importer runs headlessly, so it owns the workspace as a service
 * identity. Deliberately NOT a real person's address: Auth.js has no
 * account-linking enabled, so a seeded row sharing an email with a real
 * Google account makes that person's first sign-in fail with
 * OAuthAccountNotLinked. Real users are added by scripts/grant-access.ts
 * after they have signed in once.
 */
async function ensureUser() {
  const [found] = await db
    .select()
    .from(users)
    .where(eq(users.email, OWNER_EMAIL))
    .limit(1);
  if (found) return found;
  const [created] = await db
    .insert(users)
    .values({ email: OWNER_EMAIL, name: OWNER_EMAIL.split("@")[0] })
    .returning();
  console.log(`  created user ${OWNER_EMAIL}`);
  return created;
}

async function ensureWorkspace(userId: string) {
  const [found] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, WORKSPACE_SLUG))
    .limit(1);
  if (found) return found;

  const [created] = await db
    .insert(workspaces)
    .values({
      slug: WORKSPACE_SLUG,
      name: "St. John's",
      createdByUserId: userId,
    })
    .returning();
  await db
    .insert(workspaceMembers)
    .values({ workspaceId: created.id, userId, role: "owner" })
    .onConflictDoNothing();
  console.log(`  created workspace "${WORKSPACE_SLUG}"`);
  return created;
}

/**
 * workspace_channel requires an integration_connection row. We are reading a
 * channel we do not administer, so this placeholder records "public, API-key
 * only" access and deliberately carries no OAuth tokens.
 */
async function ensureConnection(workspaceId: string, userId: string) {
  const [found] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.externalAccountLabel, "public (no OAuth)")
      )
    )
    .limit(1);
  if (found) return found;

  const [created] = await db
    .insert(integrationConnections)
    .values({
      workspaceId,
      provider: "youtube",
      status: "active",
      externalAccountLabel: "public (no OAuth)",
      grantedByUserId: userId,
      scopes: [],
    })
    .returning();
  return created;
}

async function main() {
  console.log(`\nIngesting ${CHANNEL_URL}\n`);

  const user = await ensureUser();
  const workspace = await ensureWorkspace(user.id);
  const connection = await ensureConnection(workspace.id, user.id);

  // --- Channel ---
  const channel = await resolveChannel(CHANNEL_URL!, auth);
  console.log(`  channel: ${channel.title} (${channel.youtubeId})`);

  await db
    .insert(youtubeChannels)
    .values({
      id: channel.youtubeId,
      handle: channel.handle,
      title: channel.title,
      description: channel.description,
      thumbnailUrl: channel.thumbnailUrl,
      uploadsPlaylistProviderId: channel.uploadsPlaylistId,
    })
    .onConflictDoUpdate({
      target: youtubeChannels.id,
      set: { title: channel.title, updatedAt: new Date() },
    });

  await db
    .insert(workspaceChannels)
    .values({
      workspaceId: workspace.id,
      channelId: channel.youtubeId,
      integrationConnectionId: connection.id,
      syncStatus: "idle",
      lastSyncedAt: new Date(),
      addedByUserId: user.id,
    })
    .onConflictDoNothing();

  if (!channel.uploadsPlaylistId) throw new Error("Channel has no uploads playlist");

  // --- Videos ---
  const listed = await fetchPlaylistVideos(channel.uploadsPlaylistId, auth);
  const details = await fetchVideoDetails(
    listed.map((v) => v.youtubeId),
    auth
  );
  console.log(`  found ${listed.length} videos on the channel`);

  for (const v of listed) {
    const d = details.get(v.youtubeId);
    await db
      .insert(sourceVideos)
      .values({
        id: v.youtubeId,
        channelId: channel.youtubeId,
        title: v.title,
        description: d?.description ?? v.description,
        publishedAt: d?.publishedAt ? new Date(d.publishedAt) : null,
        durationSeconds: d?.durationSeconds ?? null,
        liveStatus: d?.liveStatus ?? null,
        scheduledStartAt: d?.scheduledStartAt ? new Date(d.scheduledStartAt) : null,
        thumbnailUrl: v.thumbnailUrl,
        lastMetadataSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: sourceVideos.id,
        set: {
          title: v.title,
          durationSeconds: d?.durationSeconds ?? null,
          liveStatus: d?.liveStatus ?? null,
          scheduledStartAt: d?.scheduledStartAt ? new Date(d.scheduledStartAt) : null,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(workspaceVideos)
      .values({
        workspaceId: workspace.id,
        videoId: v.youtubeId,
        addedByUserId: user.id,
      })
      .onConflictDoNothing();
  }

  // --- Playlists (optional) ---
  if (flag("playlists")) {
    const playlists = await fetchChannelPlaylists(channel.youtubeId, auth);
    for (const p of playlists) {
      await db
        .insert(youtubePlaylists)
        .values({
          id: p.youtubeId,
          channelId: channel.youtubeId,
          title: p.title,
          description: p.description,
          itemCount: p.itemCount,
          thumbnailUrl: p.thumbnailUrl,
        })
        .onConflictDoUpdate({
          target: youtubePlaylists.id,
          set: { title: p.title, itemCount: p.itemCount, updatedAt: new Date() },
        });
      await db
        .insert(workspacePlaylists)
        .values({
          workspaceId: workspace.id,
          playlistId: p.youtubeId,
          addedByUserId: user.id,
        })
        .onConflictDoNothing();
    }
    console.log(`  recorded ${playlists.length} playlists`);
  }

  // --- Pick what to transcribe ---
  const existing = new Set(
    (
      await db
        .select({ videoId: transcriptRevisions.videoId })
        .from(transcriptRevisions)
        .where(eq(transcriptRevisions.workspaceId, workspace.id))
    ).map((r) => r.videoId)
  );

  const queue = listed
    .filter((v) => (details.get(v.youtubeId)?.durationSeconds ?? 0) >= MIN_DURATION)
    .filter((v) => flag("redo") || !existing.has(v.youtubeId))
    .slice(0, LIMIT);

  console.log(
    `  ${existing.size} already transcribed; ingesting ${queue.length} now ` +
      `(min duration ${MIN_DURATION}s, limit ${LIMIT})\n`
  );

  let ok = 0;
  const failures: { title: string; error: string }[] = [];

  for (const [i, v] of queue.entries()) {
    const label = `[${i + 1}/${queue.length}] ${v.title.slice(0, 60)}`;
    const [run] = await db
      .insert(appRuns)
      .values({
        workspaceId: workspace.id,
        kind: "video_ingest",
        status: "queued",
        subjectType: "video",
        subjectId: v.youtubeId,
        triggeredByUserId: user.id,
        inputJson: { videoId: v.youtubeId },
      })
      .returning();

    try {
      await handleVideoIngest({
        workspaceId: workspace.id,
        videoId: v.youtubeId,
        userId: user.id,
        runId: run.id,
        allowWhisperFallback: flag("whisper"),
        useLocalWhisper: flag("local"),
      });
      ok++;
      console.log(`  ✓ ${label}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ title: v.title, error: message });
      await db
        .update(appRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          errorMessage: message.slice(0, 500),
        })
        .where(eq(appRuns.id, run.id));
      await db
        .update(workspaceVideos)
        .set({ ingestStatus: "captions_missing" })
        .where(
          and(
            eq(workspaceVideos.workspaceId, workspace.id),
            eq(workspaceVideos.videoId, v.youtubeId)
          )
        );
      console.log(`  ✗ ${label}\n      ${message.slice(0, 160)}`);
    }
  }

  console.log(`\nDone: ${ok} ingested, ${failures.length} failed.`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f.title}: ${f.error.slice(0, 120)}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
