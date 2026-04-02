import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  bigint,
  boolean,
  unique,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import { sourceVideos } from "./youtube";
import { users } from "./auth";
import {
  captionTrackKindEnum,
  transcriptRevisionKindEnum,
} from "./enums";

export const captionTracks = pgTable("caption_track", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: text("video_id")
    .notNull()
    .references(() => sourceVideos.id, { onDelete: "cascade" }),
  providerTrackId: text("provider_track_id"),
  languageCode: text("language_code").notNull(),
  kind: captionTrackKindEnum("kind").notNull().default("unknown"),
  isDefault: boolean("is_default").notNull().default(false),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  discoveredAt: timestamp("discovered_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
});

export const transcriptRevisions = pgTable(
  "transcript_revision",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => sourceVideos.id, { onDelete: "cascade" }),
    basedOnRevisionId: uuid("based_on_revision_id"),
    sourceTrackId: uuid("source_track_id").references(() => captionTracks.id),
    revisionKind: transcriptRevisionKindEnum("revision_kind").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    languageCode: text("language_code").notNull().default("en"),
    segmentCount: integer("segment_count").notNull().default(0),
    wordCount: integer("word_count").notNull().default(0),
    checksum: text("checksum"),
    blobKey: text("blob_key"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.workspaceId, t.videoId, t.revisionNumber),
    index("idx_transcript_revision_video_created").on(
      t.videoId,
      t.createdAt
    ),
  ]
);

export const transcriptSegments = pgTable(
  "transcript_segment",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => transcriptRevisions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    speakerLabel: text("speaker_label"),
    text: text("text").notNull(),
    sourceSpanJson: jsonb("source_span_json").notNull().default({}),
  },
  (t) => [
    unique().on(t.revisionId, t.seq),
    index("idx_transcript_segment_revision_seq").on(t.revisionId, t.seq),
  ]
);

export const transcriptIssues = pgTable("transcript_issue", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  revisionId: uuid("revision_id")
    .notNull()
    .references(() => transcriptRevisions.id, { onDelete: "cascade" }),
  issueType: text("issue_type").notNull(),
  anchorStartMs: integer("anchor_start_ms"),
  anchorEndMs: integer("anchor_end_ms"),
  note: text("note"),
  status: text("status").notNull().default("open"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
