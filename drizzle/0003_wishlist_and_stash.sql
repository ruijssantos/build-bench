CREATE TABLE "wishlist_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"notes" text,
	"status" text DEFAULT 'wanted' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "kit" ALTER COLUMN "status" SET DEFAULT 'wishlist';--> statement-breakpoint
ALTER TABLE "kit" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "kit" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "kit" ADD COLUMN "scalemates_url" text;--> statement-breakpoint
ALTER TABLE "kit" ADD COLUMN "image_url" text;--> statement-breakpoint
CREATE INDEX "kit_status_idx" ON "kit" USING btree ("status");