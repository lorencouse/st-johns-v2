CREATE TYPE "public"."caption_track_kind" AS ENUM('manual', 'asr', 'translated', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."channel_sync_status" AS ENUM('idle', 'syncing', 'ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."comment_anchor_type" AS ENUM('document', 'node', 'transcript_range', 'article_range');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('active', 'invalid', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."draft_version_status" AS ENUM('working', 'submitted', 'approved', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('html', 'markdown');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'editor', 'reviewer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."playlist_kind" AS ENUM('uploads', 'standard');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('drafting', 'ready_for_review', 'changes_requested', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."review_request_status" AS ENUM('open', 'approved', 'changes_requested', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."run_kind" AS ENUM('channel_sync', 'playlist_sync', 'video_ingest', 'project_generate', 'transcript_clean', 'summary_generate', 'batch_generate', 'export_render');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'blocked', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transcript_revision_kind" AS ENUM('raw_caption_import', 'normalized', 'cleaned', 'human_edited');--> statement-breakpoint
CREATE TYPE "public"."video_ingest_status" AS ENUM('discovered', 'metadata_synced', 'captions_available', 'captions_missing', 'ingest_failed');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "workspace_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"accepted_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "workspace_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_member_workspace_id_user_id_unique" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workspace_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "integration_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text DEFAULT 'youtube' NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"external_account_label" text,
	"granted_by_user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_video" (
	"playlist_id" text NOT NULL,
	"video_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_video_playlist_id_video_id_pk" PRIMARY KEY("playlist_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "source_video" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone,
	"duration_seconds" integer,
	"thumbnail_url" text,
	"default_language" text,
	"last_metadata_synced_at" timestamp with time zone,
	"provider_payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_channel" (
	"workspace_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"integration_connection_id" uuid NOT NULL,
	"sync_status" "channel_sync_status" DEFAULT 'idle' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by_user_id" uuid,
	CONSTRAINT "workspace_channel_workspace_id_channel_id_pk" PRIMARY KEY("workspace_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_playlist" (
	"workspace_id" uuid NOT NULL,
	"playlist_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by_user_id" uuid,
	CONSTRAINT "workspace_playlist_workspace_id_playlist_id_pk" PRIMARY KEY("workspace_id","playlist_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_video" (
	"workspace_id" uuid NOT NULL,
	"video_id" text NOT NULL,
	"ingest_status" "video_ingest_status" DEFAULT 'discovered' NOT NULL,
	"last_captions_checked_at" timestamp with time zone,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by_user_id" uuid,
	CONSTRAINT "workspace_video_workspace_id_video_id_pk" PRIMARY KEY("workspace_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "youtube_channel" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" text,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"uploads_playlist_provider_id" text,
	"provider_payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_playlist" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"kind" "playlist_kind" DEFAULT 'standard' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"thumbnail_url" text,
	"provider_payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caption_track" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"provider_track_id" text,
	"language_code" text NOT NULL,
	"kind" "caption_track_kind" DEFAULT 'unknown' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transcript_issue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"issue_type" text NOT NULL,
	"anchor_start_ms" integer,
	"anchor_end_ms" integer,
	"note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by_user_id" uuid,
	"resolved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transcript_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_id" text NOT NULL,
	"based_on_revision_id" uuid,
	"source_track_id" uuid,
	"revision_kind" "transcript_revision_kind" NOT NULL,
	"revision_number" integer NOT NULL,
	"language_code" text DEFAULT 'en' NOT NULL,
	"segment_count" integer DEFAULT 0 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"checksum" text,
	"blob_key" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_revision_workspace_id_video_id_revision_number_unique" UNIQUE("workspace_id","video_id","revision_number")
);
--> statement-breakpoint
CREATE TABLE "transcript_segment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transcript_segment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"revision_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"speaker_label" text,
	"text" text NOT NULL,
	"source_span_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "transcript_segment_revision_id_seq_unique" UNIQUE("revision_id","seq")
);
--> statement-breakpoint
CREATE TABLE "content_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_video_id" text NOT NULL,
	"template_id" uuid,
	"title" text NOT NULL,
	"status" "project_status" DEFAULT 'drafting' NOT NULL,
	"assignee_user_id" uuid,
	"active_draft_version_id" uuid,
	"current_review_request_id" uuid,
	"due_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"prompt_config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"document_rules_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"export_defaults_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_project_id" uuid NOT NULL,
	"parent_draft_version_id" uuid,
	"source_transcript_revision_id" uuid,
	"version_number" integer NOT NULL,
	"status" "draft_version_status" DEFAULT 'working' NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"summary" text,
	"content_json" jsonb NOT NULL,
	"plain_text" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_version_content_project_id_version_number_unique" UNIQUE("content_project_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "comment_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_project_id" uuid NOT NULL,
	"draft_version_id" uuid NOT NULL,
	"anchor_type" "comment_anchor_type" NOT NULL,
	"anchor_key" text,
	"anchor_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_request_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"decided_by_user_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_project_id" uuid NOT NULL,
	"requested_version_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"assigned_to_user_id" uuid,
	"status" "review_request_status" DEFAULT 'open' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "run_kind" NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text,
	"idempotency_key" text,
	"triggered_by_user_id" uuid,
	"input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"event_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_project_id" uuid NOT NULL,
	"source_draft_version_id" uuid NOT NULL,
	"format" "export_format" NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"body_text" text,
	"blob_key" text,
	"checksum" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_step" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "run_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"step_key" text NOT NULL,
	"status" "run_status" NOT NULL,
	"message" text,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "run_step_run_id_seq_unique" UNIQUE("run_id","seq")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_video" ADD CONSTRAINT "playlist_video_playlist_id_youtube_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."youtube_playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_video" ADD CONSTRAINT "playlist_video_video_id_source_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."source_video"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_video" ADD CONSTRAINT "source_video_channel_id_youtube_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."youtube_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_channel" ADD CONSTRAINT "workspace_channel_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_channel" ADD CONSTRAINT "workspace_channel_channel_id_youtube_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."youtube_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_channel" ADD CONSTRAINT "workspace_channel_integration_connection_id_integration_connection_id_fk" FOREIGN KEY ("integration_connection_id") REFERENCES "public"."integration_connection"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_channel" ADD CONSTRAINT "workspace_channel_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_playlist" ADD CONSTRAINT "workspace_playlist_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_playlist" ADD CONSTRAINT "workspace_playlist_playlist_id_youtube_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."youtube_playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_playlist" ADD CONSTRAINT "workspace_playlist_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_video" ADD CONSTRAINT "workspace_video_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_video" ADD CONSTRAINT "workspace_video_video_id_source_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."source_video"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_video" ADD CONSTRAINT "workspace_video_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_playlist" ADD CONSTRAINT "youtube_playlist_channel_id_youtube_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."youtube_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caption_track" ADD CONSTRAINT "caption_track_video_id_source_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."source_video"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_issue" ADD CONSTRAINT "transcript_issue_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_issue" ADD CONSTRAINT "transcript_issue_revision_id_transcript_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."transcript_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_issue" ADD CONSTRAINT "transcript_issue_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_issue" ADD CONSTRAINT "transcript_issue_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_revision" ADD CONSTRAINT "transcript_revision_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_revision" ADD CONSTRAINT "transcript_revision_video_id_source_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."source_video"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_revision" ADD CONSTRAINT "transcript_revision_source_track_id_caption_track_id_fk" FOREIGN KEY ("source_track_id") REFERENCES "public"."caption_track"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_revision" ADD CONSTRAINT "transcript_revision_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_segment" ADD CONSTRAINT "transcript_segment_revision_id_transcript_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."transcript_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_project" ADD CONSTRAINT "content_project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_project" ADD CONSTRAINT "content_project_source_video_id_source_video_id_fk" FOREIGN KEY ("source_video_id") REFERENCES "public"."source_video"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_project" ADD CONSTRAINT "content_project_template_id_content_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."content_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_project" ADD CONSTRAINT "content_project_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_project" ADD CONSTRAINT "content_project_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_template" ADD CONSTRAINT "content_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_template" ADD CONSTRAINT "content_template_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_version" ADD CONSTRAINT "draft_version_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_version" ADD CONSTRAINT "draft_version_content_project_id_content_project_id_fk" FOREIGN KEY ("content_project_id") REFERENCES "public"."content_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_version" ADD CONSTRAINT "draft_version_source_transcript_revision_id_transcript_revision_id_fk" FOREIGN KEY ("source_transcript_revision_id") REFERENCES "public"."transcript_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_version" ADD CONSTRAINT "draft_version_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_content_project_id_content_project_id_fk" FOREIGN KEY ("content_project_id") REFERENCES "public"."content_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_draft_version_id_draft_version_id_fk" FOREIGN KEY ("draft_version_id") REFERENCES "public"."draft_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_thread_id_comment_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."comment_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_review_request_id_review_request_id_fk" FOREIGN KEY ("review_request_id") REFERENCES "public"."review_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_content_project_id_content_project_id_fk" FOREIGN KEY ("content_project_id") REFERENCES "public"."content_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_requested_version_id_draft_version_id_fk" FOREIGN KEY ("requested_version_id") REFERENCES "public"."draft_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_run" ADD CONSTRAINT "app_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_run" ADD CONSTRAINT "app_run_triggered_by_user_id_user_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifact" ADD CONSTRAINT "export_artifact_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifact" ADD CONSTRAINT "export_artifact_content_project_id_content_project_id_fk" FOREIGN KEY ("content_project_id") REFERENCES "public"."content_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifact" ADD CONSTRAINT "export_artifact_source_draft_version_id_draft_version_id_fk" FOREIGN KEY ("source_draft_version_id") REFERENCES "public"."draft_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifact" ADD CONSTRAINT "export_artifact_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_step" ADD CONSTRAINT "run_step_run_id_app_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."app_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_playlist_video_video" ON "playlist_video" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "idx_source_video_channel" ON "source_video" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_source_video_published" ON "source_video" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_workspace_channel_sync" ON "workspace_channel" USING btree ("workspace_id","sync_status");--> statement-breakpoint
CREATE INDEX "idx_workspace_video_status" ON "workspace_video" USING btree ("workspace_id","ingest_status");--> statement-breakpoint
CREATE INDEX "idx_youtube_playlist_channel" ON "youtube_playlist" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_transcript_revision_video_created" ON "transcript_revision" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_transcript_segment_revision_seq" ON "transcript_segment" USING btree ("revision_id","seq");--> statement-breakpoint
CREATE INDEX "idx_content_project_workspace_status" ON "content_project" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_content_project_source_video" ON "content_project" USING btree ("source_video_id");--> statement-breakpoint
CREATE INDEX "idx_draft_version_project_version" ON "draft_version" USING btree ("content_project_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_review_request_workspace_status" ON "review_request" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_review_request_assigned_status" ON "review_request" USING btree ("assigned_to_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_app_run_workspace_kind_created" ON "app_run" USING btree ("workspace_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "idx_app_run_subject" ON "app_run" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "idx_audit_event_workspace_created" ON "audit_event" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_export_artifact_project_created" ON "export_artifact" USING btree ("content_project_id","created_at");