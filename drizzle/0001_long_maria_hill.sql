CREATE TABLE "account_entitlements" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"free_site_used" boolean DEFAULT false NOT NULL,
	"paid_site_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_claims" (
	"device_hash" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "device_claims_owner_idx" ON "device_claims" USING btree ("owner_id");
--> statement-breakpoint
INSERT INTO "account_entitlements" ("owner_id", "free_site_used")
SELECT "owner_id", true
FROM "sites"
GROUP BY "owner_id"
ON CONFLICT ("owner_id") DO NOTHING;