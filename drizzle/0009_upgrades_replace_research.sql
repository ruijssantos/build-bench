-- Replay-safe per the rule in scripts/migrate.mts: Neon's HTTP driver has no
-- transactions, so a failure part-way records nothing and the next run
-- replays from the top.

-- The research panel's difficulty, fit issues and tips are gone, and the
-- owner asked for their data to go with them. kit_research first: its job_id
-- references research_job.
DELETE FROM "kit_research";--> statement-breakpoint
DELETE FROM "research_job";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "difficulty";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "difficulty_note";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "fit_issues";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "tips";--> statement-breakpoint
-- Two token counts couldn't price a run: cache reads and writes bill at
-- different rates, and web searches bill per call. `usage` holds all of it.
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "input_tokens";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "output_tokens";--> statement-breakpoint
ALTER TABLE "kit_research" ADD COLUMN IF NOT EXISTS "upgrades" jsonb;--> statement-breakpoint
ALTER TABLE "kit_research" ADD COLUMN IF NOT EXISTS "usage" jsonb;--> statement-breakpoint
ALTER TABLE "research_job" ADD COLUMN IF NOT EXISTS "usage" jsonb;
