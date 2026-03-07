import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import { contentProjects, draftVersions } from "./editorial";
import { users } from "./auth";
import {
  commentAnchorTypeEnum,
  reviewRequestStatusEnum,
} from "./enums";

export const commentThreads = pgTable("comment_thread", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  contentProjectId: uuid("content_project_id")
    .notNull()
    .references(() => contentProjects.id, { onDelete: "cascade" }),
  draftVersionId: uuid("draft_version_id")
    .notNull()
    .references(() => draftVersions.id, { onDelete: "cascade" }),
  anchorType: commentAnchorTypeEnum("anchor_type").notNull(),
  anchorKey: text("anchor_key"),
  anchorJson: jsonb("anchor_json").notNull().default({}),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
});

export const comments = pgTable("comment", {
  id: uuid("id").defaultRandom().primaryKey(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => commentThreads.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const reviewRequests = pgTable(
  "review_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentProjectId: uuid("content_project_id")
      .notNull()
      .references(() => contentProjects.id, { onDelete: "cascade" }),
    requestedVersionId: uuid("requested_version_id")
      .notNull()
      .references(() => draftVersions.id, { onDelete: "restrict" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    status: reviewRequestStatusEnum("status").notNull().default("open"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_review_request_workspace_status").on(
      t.workspaceId,
      t.status
    ),
    index("idx_review_request_assigned_status").on(
      t.assignedToUserId,
      t.status
    ),
  ]
);

export const reviewDecisions = pgTable("review_decision", {
  id: uuid("id").defaultRandom().primaryKey(),
  reviewRequestId: uuid("review_request_id")
    .notNull()
    .references(() => reviewRequests.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  decidedByUserId: uuid("decided_by_user_id")
    .notNull()
    .references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
