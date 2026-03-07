import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  unique,
  jsonb,
  index,
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

export const youtubeChannels = pgTable(
  "youtube_channel",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    integrationConnectionId: uuid("integration_connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "restrict" }),
    providerChannelId: text("provider_channel_id").notNull(),
    handle: text("handle"),
    title: text("title").notNull(),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    uploadsPlaylistProviderId: text("uploads_playlist_provider_id"),
    syncStatus: channelSyncStatusEnum("sync_status")
      .notNull()
      .default("idle"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    providerPayloadJson: jsonb("provider_payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.workspaceId, t.providerChannelId),
    index("idx_youtube_channel_workspace_sync").on(
      t.workspaceId,
      t.syncStatus
    ),
  ]
);

export const youtubePlaylists = pgTable(
  "youtube_playlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => youtubeChannels.id, { onDelete: "cascade" }),
    providerPlaylistId: text("provider_playlist_id").notNull(),
    kind: playlistKindEnum("kind").notNull().default("standard"),
    title: text("title").notNull(),
    description: text("description"),
    itemCount: integer("item_count").notNull().default(0),
    thumbnailUrl: text("thumbnail_url"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    providerPayloadJson: jsonb("provider_payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.workspaceId, t.providerPlaylistId),
    index("idx_youtube_playlist_channel").on(t.channelId),
  ]
);

export const sourceVideos = pgTable(
  "source_video",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => youtubeChannels.id, { onDelete: "cascade" }),
    providerVideoId: text("provider_video_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),
    defaultLanguage: text("default_language"),
    ingestStatus: videoIngestStatusEnum("ingest_status")
      .notNull()
      .default("discovered"),
    lastMetadataSyncedAt: timestamp("last_metadata_synced_at", {
      withTimezone: true,
    }),
    lastCaptionsCheckedAt: timestamp("last_captions_checked_at", {
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
    unique().on(t.workspaceId, t.providerVideoId),
    index("idx_source_video_workspace_published").on(
      t.workspaceId,
      t.publishedAt
    ),
    index("idx_source_video_channel").on(t.channelId),
  ]
);

export const playlistVideos = pgTable(
  "playlist_video",
  {
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => youtubePlaylists.id, { onDelete: "cascade" }),
    videoId: uuid("video_id")
      .notNull()
      .references(() => sourceVideos.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_playlist_video_video").on(t.videoId)]
);
