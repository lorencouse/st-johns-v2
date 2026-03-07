import { pgEnum } from "drizzle-orm/pg-core";

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "editor",
  "reviewer",
  "viewer",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "active",
  "invalid",
  "revoked",
  "error",
]);

export const channelSyncStatusEnum = pgEnum("channel_sync_status", [
  "idle",
  "syncing",
  "ok",
  "error",
]);

export const playlistKindEnum = pgEnum("playlist_kind", [
  "uploads",
  "standard",
]);

export const videoIngestStatusEnum = pgEnum("video_ingest_status", [
  "discovered",
  "metadata_synced",
  "captions_available",
  "captions_missing",
  "ingest_failed",
]);

export const captionTrackKindEnum = pgEnum("caption_track_kind", [
  "manual",
  "asr",
  "translated",
  "unknown",
]);

export const transcriptRevisionKindEnum = pgEnum("transcript_revision_kind", [
  "raw_caption_import",
  "normalized",
  "cleaned",
  "human_edited",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "drafting",
  "ready_for_review",
  "changes_requested",
  "approved",
  "archived",
]);

export const draftVersionStatusEnum = pgEnum("draft_version_status", [
  "working",
  "submitted",
  "approved",
  "superseded",
]);

export const commentAnchorTypeEnum = pgEnum("comment_anchor_type", [
  "document",
  "node",
  "transcript_range",
  "article_range",
]);

export const reviewRequestStatusEnum = pgEnum("review_request_status", [
  "open",
  "approved",
  "changes_requested",
  "cancelled",
]);

export const exportFormatEnum = pgEnum("export_format", ["html", "markdown"]);

export const runKindEnum = pgEnum("run_kind", [
  "channel_sync",
  "playlist_sync",
  "video_ingest",
  "project_generate",
  "transcript_clean",
  "summary_generate",
  "batch_generate",
  "export_render",
]);

export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
]);
