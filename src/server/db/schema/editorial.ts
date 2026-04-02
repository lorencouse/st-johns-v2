import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  unique,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import { sourceVideos } from "./youtube";
import { transcriptRevisions } from "./transcript";
import { users } from "./auth";
import {
  projectStatusEnum,
  draftVersionStatusEnum,
} from "./enums";

export const contentTemplates = pgTable("content_template", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description"),
  promptConfigJson: jsonb("prompt_config_json").notNull().default({}),
  documentRulesJson: jsonb("document_rules_json").notNull().default({}),
  exportDefaultsJson: jsonb("export_defaults_json").notNull().default({}),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const contentProjects = pgTable(
  "content_project",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceVideoId: text("source_video_id")
      .notNull()
      .references(() => sourceVideos.id, { onDelete: "restrict" }),
    templateId: uuid("template_id").references(() => contentTemplates.id),
    title: text("title").notNull(),
    status: projectStatusEnum("status").notNull().default("drafting"),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id),
    activeDraftVersionId: uuid("active_draft_version_id"),
    currentReviewRequestId: uuid("current_review_request_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_content_project_workspace_status").on(
      t.workspaceId,
      t.status
    ),
    index("idx_content_project_source_video").on(t.sourceVideoId),
  ]
);

export const draftVersions = pgTable(
  "draft_version",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentProjectId: uuid("content_project_id")
      .notNull()
      .references(() => contentProjects.id, { onDelete: "cascade" }),
    parentDraftVersionId: uuid("parent_draft_version_id"),
    sourceTranscriptRevisionId: uuid(
      "source_transcript_revision_id"
    ).references(() => transcriptRevisions.id),
    versionNumber: integer("version_number").notNull(),
    status: draftVersionStatusEnum("status").notNull().default("working"),
    title: text("title").notNull(),
    intro: text("intro"),
    summary: text("summary"),
    contentJson: jsonb("content_json").notNull(),
    plainText: text("plain_text"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.contentProjectId, t.versionNumber),
    index("idx_draft_version_project_version").on(
      t.contentProjectId,
      t.versionNumber
    ),
  ]
);
