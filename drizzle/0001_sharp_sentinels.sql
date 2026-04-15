CREATE TYPE "public"."user_role" AS ENUM('user', 'premium', 'admin');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
UPDATE "user" SET "role" = 'admin' WHERE "email" = 'couselm@gmail.com';