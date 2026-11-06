CREATE TABLE "service_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_video_id" text NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"text_status" text NOT NULL,
	"extracted_text" text,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_document_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "service_document" ADD CONSTRAINT "service_document_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_document" ADD CONSTRAINT "service_document_source_video_id_source_video_id_fk" FOREIGN KEY ("source_video_id") REFERENCES "public"."source_video"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_document" ADD CONSTRAINT "service_document_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_service_document_workspace_video" ON "service_document" USING btree ("workspace_id","source_video_id");