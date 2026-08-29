import { and, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { inventoryItem, kit, kitPaintRequirement } from "@/db/schema";
import { STASH_STATUSES } from "@/domain/kit";

import { INVENTORY_TAG } from "./inventory";
import { kitTag, KIT_TAG } from "./kits";

/**
 * `kit_paint_requirement` — docs/PLAN.md §3.2, §4.3: what a manual's paint
 * callouts turn into once extracted. Same two-layer shape as `./kits.ts`.
 */

/** Invalidated by any write to any kit's requirements — the Stash grid's
 * aggregate readiness query (below) reads across every kit at once, so a
 * narrower per-kit tag alone wouldn't cover it. */
export const KIT_REQUIREMENTS_TAG = "kit-paint-requirement";

export interface PaintRequirementRow {
  id: number;
  kitId: number;
  manualId: number | null;
  rawLabel: string | null;
  paintCode: string | null;
  partHint: string | null;
  source: string | null;
  confidence: number | null;
}

export async function listKitPaintRequirements(kitId: number): Promise<PaintRequirementRow[]> {
  await connection();
  return queryKitPaintRequirements(kitId);
}

async function queryKitPaintRequirements(kitId: number): Promise<PaintRequirementRow[]> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(kitTag(kitId));

  return db.select().from(kitPaintRequirement).where(eq(kitPaintRequirement.kitId, kitId));
}

export interface NewPaintRequirement {
  rawLabel: string;
  paintCode: string | null;
  partHint: string | null;
}

/**
 * Re-running "Extract paint list" on a manual replaces that manual's rows
 * rather than duplicating them (docs/PLAN.md §4.3) — delete then insert,
 * two statements rather than one transaction: Neon's HTTP driver has no
 * transactions (see `scripts/migrate.mts`'s note), the same constraint every
 * multi-statement write in this app already lives with.
 */
export async function replaceManualPaintRequirements(
  kitId: number,
  manualId: number,
  rows: NewPaintRequirement[],
): Promise<void> {
  await db
    .delete(kitPaintRequirement)
    .where(and(eq(kitPaintRequirement.kitId, kitId), eq(kitPaintRequirement.manualId, manualId)));

  if (rows.length === 0) return;

  await db.insert(kitPaintRequirement).values(
    rows.map((row) => ({
      kitId,
      manualId,
      rawLabel: row.rawLabel,
      paintCode: row.paintCode,
      partHint: row.partHint,
      source: "manual_pdf",
    })),
  );
}

export interface KitReadiness {
  kitId: number;
  ownedCount: number;
  missingCount: number;
  unresolvedCount: number;
}

/**
 * The Stash grid's "14 of 17 · 3 to buy" line, for every stashed kit at
 * once — one aggregate query, not N+1 per card (docs/PLAN.md §6 Phase 4a).
 *
 * Counts *distinct* paint codes: one code can have several shelf rows (a
 * spray can and the jar decanted from it), and the left join fans out to one
 * row per matching shelf entry, which `count(distinct …)` collapses back
 * down rather than over-counting.
 */
export async function getStashReadiness(): Promise<KitReadiness[]> {
  await connection();
  return queryStashReadiness();
}

async function queryStashReadiness(): Promise<KitReadiness[]> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(KIT_TAG);
  cacheTag(KIT_REQUIREMENTS_TAG);
  cacheTag(INVENTORY_TAG);

  const rows = await db
    .select({
      kitId: kitPaintRequirement.kitId,
      ownedCount: sql<number>`count(distinct ${kitPaintRequirement.paintCode}) filter (where ${kitPaintRequirement.paintCode} is not null and ${inventoryItem.paintCode} is not null)`,
      missingCount: sql<number>`count(distinct ${kitPaintRequirement.paintCode}) filter (where ${kitPaintRequirement.paintCode} is not null and ${inventoryItem.paintCode} is null)`,
      unresolvedCount: sql<number>`count(distinct ${kitPaintRequirement.rawLabel}) filter (where ${kitPaintRequirement.paintCode} is null)`,
    })
    .from(kitPaintRequirement)
    .innerJoin(kit, eq(kit.id, kitPaintRequirement.kitId))
    .leftJoin(inventoryItem, eq(inventoryItem.paintCode, kitPaintRequirement.paintCode))
    .where(inArray(kit.status, [...STASH_STATUSES]))
    .groupBy(kitPaintRequirement.kitId);

  return rows.map((row) => ({
    kitId: row.kitId,
    ownedCount: Number(row.ownedCount),
    missingCount: Number(row.missingCount),
    unresolvedCount: Number(row.unresolvedCount),
  }));
}
