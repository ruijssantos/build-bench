ALTER TABLE "kit_research" ADD COLUMN IF NOT EXISTS "tips" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_research_kit_idx" ON "kit_research" USING btree ("kit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_job_kit_idx" ON "research_job" USING btree ("kit_id");
