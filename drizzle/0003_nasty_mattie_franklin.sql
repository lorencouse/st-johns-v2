ALTER TABLE "source_video" ADD COLUMN "live_status" text;--> statement-breakpoint
ALTER TABLE "source_video" ADD COLUMN "scheduled_start_at" timestamp with time zone;