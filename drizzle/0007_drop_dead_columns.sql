-- Replay-safe per the rule in scripts/migrate.mts: Neon's HTTP driver has no
-- transactions, so a failure part-way leaves nothing recorded and the next run
-- replays from the top.

-- The cross-brand chart as tables. Seeded since 0000_init, never read: every
-- lookup goes through src/catalogue/equivalents.ts and the committed JSON.
-- CASCADE covers paint_equivalent's foreign keys into paint_brand and paint.
DROP TABLE IF EXISTS "paint_equivalent" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "paint_brand" CASCADE;--> statement-breakpoint

-- Selected into a row type nothing reads; the `decanted_jar` form carries the
-- concept on its own.
ALTER TABLE "inventory_item" DROP CONSTRAINT IF EXISTS "inventory_item_decanted_from_paint_code_fk";--> statement-breakpoint
ALTER TABLE "inventory_item" DROP COLUMN IF EXISTS "decanted_from";--> statement-breakpoint

-- part_hint was extracted and stored on every run and rendered nowhere;
-- confidence was never written at all.
ALTER TABLE "kit_paint_requirement" DROP COLUMN IF EXISTS "part_hint";--> statement-breakpoint
ALTER TABLE "kit_paint_requirement" DROP COLUMN IF EXISTS "confidence";--> statement-breakpoint

-- kit_research's unwritten half: three resolved_* columns stage C never filled,
-- the two link-outs removed in Phase 7, the Verify mark removed with them, and
-- an expiry nothing ever set.
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "resolved_brand";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "resolved_number";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "resolved_name";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "manual_url";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "build_video_url";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "verified_by_me";--> statement-breakpoint
ALTER TABLE "kit_research" DROP COLUMN IF EXISTS "expires_at";--> statement-breakpoint

-- The one addition: did the pages extraction read hold the paint chart?
ALTER TABLE "kit_manual" ADD COLUMN IF NOT EXISTS "paint_chart_found" boolean;
