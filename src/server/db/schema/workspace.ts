import {
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { memberRoleEnum, inviteStatusEnum } from "./enums";

export const workspaces = pgTable("workspace", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Chicago"),
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
});

export const workspaceMembers = pgTable(
  "workspace_member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.workspaceId, t.userId)]
);

export const workspaceInvites = pgTable("workspace_invite", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: memberRoleEnum("role").notNull(),
  tokenHash: text("token_hash").unique().notNull(),
  status: inviteStatusEnum("status").notNull().default("pending"),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
