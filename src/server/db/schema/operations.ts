import {
  pgTable,
  text,
  timestamp,
  uuid,
  bigint,
  integer,
  index,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import { contentProjects, draftVersions } from "./editorial";
import { users } from "./auth";
import {
  exportFormatEnum,
  runKindEnum,
  runStatusEnum,
} from "./enums";

export const exportArtifacts = pgTable(
  "export_artifact",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentProjectId: uuid("content_project_id")
      .notNull()
      .references(() => contentProjects.id, { onDelete: "cascade" }),
    sourceDraftVersionId: uuid("source_draft_version_id")
      .notNull()
      .references(() => draftVersions.id, { onDelete: "restrict" }),
    format: exportFormatEnum("format").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    bodyText: text("body_text"),
    blobKey: text("blob_key"),
    checksum: text("checksum"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_export_artifact_project_created").on(
      t.contentProjectId,
      t.createdAt
    ),
  ]
);

export const appRuns = pgTable(
  "app_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: runKindEnum("kind").notNull(),
    status: runStatusEnum("status").notNull().default("queued"),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id"),
    idempotencyKey: text("idempotency_key"),
    triggeredByUserId: uuid("triggered_by_user_id").references(() => users.id),
    inputJson: jsonb("input_json").notNull().default({}),
    outputJson: jsonb("output_json").notNull().default({}),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_app_run_workspace_kind_created").on(
      t.workspaceId,
      t.kind,
      t.createdAt
    ),
    index("idx_app_run_subject").on(t.subjectType, t.subjectId),
  ]
);

export const runSteps = pgTable(
  "run_step",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    runId: uuid("run_id")
      .notNull()
      .references(() => appRuns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    stepKey: text("step_key").notNull(),
    status: runStatusEnum("status").notNull(),
    message: text("message"),
    attemptCount: integer("attempt_count").notNull().default(1),
    payloadJson: jsonb("payload_json").notNull().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.runId, t.seq)]
);

export const auditEvents = pgTable(
  "audit_event",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    eventKey: text("event_key").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    summary: text("summary"),
    payloadJson: jsonb("payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_audit_event_workspace_created").on(
      t.workspaceId,
      t.createdAt
    ),
  ]
);
