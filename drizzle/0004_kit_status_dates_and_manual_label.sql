ALTER TABLE "kit" ADD COLUMN IF NOT EXISTS "started_at" date;--> statement-breakpoint
ALTER TABLE "kit" ADD COLUMN IF NOT EXISTS "completed_at" date;--> statement-breakpoint
ALTER TABLE "kit_manual" ADD COLUMN IF NOT EXISTS "label" text;
