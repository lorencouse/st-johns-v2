import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspace";
import {
  connectionStatusEnum,
  channelSyncStatusEnum,
  playlistKindEnum,
  videoIngestStatusEnum,
} from "./enums";
import { users } from "./auth";

/* ------------------------------------------------------------------ */
/*  Integration connections (unchanged – workspace-scoped OAuth)      */
/* ------------------------------------------------------------------ */

export const integrationConnections = pgTable("integration_connection", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("youtube"),
  status: connectionStatusEnum("status").notNull().default("active"),
  externalAccountLabel: text("external_account_label"),
  grantedByUserId: uuid("granted_by_user_id")
    .notNull()
    .references(() => users.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: text("scopes")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ------------------------------------------------------------------ */
/*  Global YouTube entities – keyed by YouTube ID (text PK)           */
/* ------------------------------------------------------------------ */

export const youtubeChannels = pgTable("youtube_channel", {
  id: text("id").primaryKey(), // YouTube channel ID, e.g. "UCxxxxxx"
  handle: text("handle"),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  uploadsPlaylistProviderId: text("uploads_playlist_provider_id"),
  providerPayloadJson: jsonb("provider_payload_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sourceVideos = pgTable(
  "source_video",
  {
    id: text("id").primaryKey(), // YouTube video ID, e.g. "dQw4w9WgXcQ"
    channelId: text("channel_id")
      .notNull()
      .references(() => youtubeChannels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    /**
     * YouTube's liveBroadcastContent: "upcoming" for a scheduled premiere or
     * stream, "live" while it airs, "none" for an ordinary video. An upcoming
     * stream has no audio yet, so it can never be transcribed — the library
     * shows it as scheduled rather than as a video awaiting captions.
     */
    liveStatus: text("live_status"),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
    thumbnailUrl: text("thumbnail_url"),
    defaultLanguage: text("default_language"),
    lastMetadataSyncedAt: timestamp("last_metadata_synced_at", {
      withTimezone: true,
    }),
    providerPayloadJson: jsonb("provider_payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_source_video_channel").on(t.channelId),
    index("idx_source_video_published").on(t.publishedAt),
  ]
);

export const youtubePlaylists = pgTable(
  "youtube_playlist",
  {
    id: text("id").primaryKey(), // YouTube playlist ID, e.g. "PLxxxxxx"
    channelId: text("channel_id")
      .notNull()
      .references(() => youtubeChannels.id, { onDelete: "cascade" }),
    kind: playlistKindEnum("kind").notNull().default("standard"),
    title: text("title").notNull(),
    description: text("description"),
    itemCount: integer("item_count").notNull().default(0),
    thumbnailUrl: text("thumbnail_url"),
    providerPayloadJson: jsonb("provider_payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_youtube_playlist_channel").on(t.channelId)]
);

export const playlistVideos = pgTable(
  "playlist_video",
  {
    playlistId: text("playlist_id")
      .notNull()
      .references(() => youtubePlaylists.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => sourceVideos.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.playlistId, t.videoId] }),
    index("idx_playlist_video_video").on(t.videoId),
  ]
);

/* ------------------------------------------------------------------ */
/*  Workspace ↔ YouTube junction tables                               */
/* ------------------------------------------------------------------ */

export const workspaceChannels = pgTable(
  "workspace_channel",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => youtubeChannels.id, { onDelete: "cascade" }),
    integrationConnectionId: uuid("integration_connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "restrict" }),
    syncStatus: channelSyncStatusEnum("sync_status")
      .notNull()
      .default("idle"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    addedByUserId: uuid("added_by_user_id").references(() => users.id),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.channelId] }),
    index("idx_workspace_channel_sync").on(t.workspaceId, t.syncStatus),
  ]
);

export const workspaceVideos = pgTable(
  "workspace_video",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => sourceVideos.id, { onDelete: "cascade" }),
    ingestStatus: videoIngestStatusEnum("ingest_status")
      .notNull()
      .default("discovered"),
    lastCaptionsCheckedAt: timestamp("last_captions_checked_at", {
      withTimezone: true,
    }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    addedByUserId: uuid("added_by_user_id").references(() => users.id),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.videoId] }),
    index("idx_workspace_video_status").on(t.workspaceId, t.ingestStatus),
  ]
);

export const workspacePlaylists = pgTable(
  "workspace_playlist",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    playlistId: text("playlist_id")
      .notNull()
      .references(() => youtubePlaylists.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    addedByUserId: uuid("added_by_user_id").references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.playlistId] })]
);
