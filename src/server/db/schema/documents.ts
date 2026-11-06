import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { workspaces } from "./workspace";
import { sourceVideos } from "./youtube";

/**
 * A supporting file for one service: the sermon text or notes, the printed
 * bulletin, or anything else. The file itself lives in R2 under storageKey;
 * the text read out of it is kept here so drafts and word checks can use it.
 */
export const serviceDocuments = pgTable(
  "service_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceVideoId: text("source_video_id")
      .notNull()
      .references(() => sourceVideos.id, { onDelete: "cascade" }),
    /** "sermon", "bulletin" or "other". */
    kind: text("kind").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    /** "done" when text was read out of the file, "failed" when it could not be. */
    textStatus: text("text_status").notNull(),
    extractedText: text("extracted_text"),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_service_document_workspace_video").on(
      t.workspaceId,
      t.sourceVideoId
    ),
  ]
);
