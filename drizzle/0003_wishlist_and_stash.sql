CREATE TABLE IF NOT EXISTS "wishlist_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"notes" text,
	"status" text DEFAULT 'wanted' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "kit" ALTER COLUMN "status" SET DEFAULT 'wishlist';--> statement-breakpoint
UPDATE "kit" SET "status" = 'wishlist' WHERE "status" IS NULL;--> statement-breakpoint
ALTER TABLE "kit" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "kit" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
ALTER TABLE "kit" ADD COLUMN IF NOT EXISTS "scalemates_url" text;--> statement-breakpoint
ALTER TABLE "kit" ADD COLUMN IF NOT EXISTS "image_url" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_status_idx" ON "kit" USING btree ("status");
