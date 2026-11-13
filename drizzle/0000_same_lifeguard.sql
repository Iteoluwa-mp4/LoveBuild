CREATE TYPE "public"."site_status" AS ENUM('draft', 'submitted', 'published');--> statement-breakpoint
CREATE TABLE "sites" (
	"slug" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"status" "site_status" DEFAULT 'draft' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"site" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sites_owner_updated_idx" ON "sites" USING btree ("owner_id","updated_at");