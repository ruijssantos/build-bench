-- Replay-safe per the rule in scripts/migrate.mts: Neon's HTTP driver has no
-- transactions, so a failure part-way records nothing and the next run
-- replays from the top.

-- Set when the owner dismisses an unresolved callout. A column here rather
-- than a list elsewhere is what makes "re-extracting resets it" free:
-- replaceManualPaintRequirements writes fresh rows and drops the old ones, so
-- a re-run cannot carry a dismissal forward.
ALTER TABLE "kit_paint_requirement" ADD COLUMN IF NOT EXISTS "dismissed_at" timestamp with time zone;
