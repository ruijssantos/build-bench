import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { kitManual, kitPaintRequirement } from "@/db/schema";

import { kitTag } from "./kits";

/**
 * `kit_manual` — docs/PLAN.md §3.2, §4.3. User-uploaded PDFs, never
 * auto-downloaded. Same two-layer shape as `./kits.ts`: `connection()` pins
 * reads to request time, `use cache` then makes a repeat visit free.
 */

export interface KitManualRow {
  id: number;
  kitId: number;
  blobUrl: string;
  filename: string | null;
  label: string | null;
  sizeBytes: number | null;
  pageCount: number | null;
  paintsExtractedAt: Date | null;
  uploadedAt: Date | null;
}

export async function listKitManuals(kitId: number): Promise<KitManualRow[]> {
  await connection();
  return queryKitManuals(kitId);
}

async function queryKitManuals(kitId: number): Promise<KitManualRow[]> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(kitTag(kitId));

  return db.select().from(kitManual).where(eq(kitManual.kitId, kitId)).orderBy(kitManual.uploadedAt);
}

/** Uncached — read immediately before a mutation (extract, delete), the same
 * reasoning as `kits.ts`'s `findKitById`. Scoped to `kitId` so one kit's
 * manual id can't be used to reach another kit's row. */
export async function findKitManualById(id: number, kitId: number): Promise<KitManualRow | undefined> {
  const rows = await db
    .select()
    .from(kitManual)
    .where(and(eq(kitManual.id, id), eq(kitManual.kitId, kitId)))
    .limit(1);
  return rows[0];
}

export interface CreateKitManualInput {
  kitId: number;
  blobUrl: string;
  filename: string | null;
  label: string | null;
  sizeBytes: number | null;
}

export async function createKitManual(input: CreateKitManualInput): Promise<number> {
  const rows = await db
    .insert(kitManual)
    .values({ ...input, uploadedAt: new Date() })
    .returning({ id: kitManual.id });
  return rows[0].id;
}

/**
 * Removes a manual and the paint requirements extracted from it.
 *
 * The requirements go first: `kit_paint_requirement.manual_id` references
 * `kit_manual(id)` with `ON DELETE no action` (`drizzle/0000_init.sql`), so
 * deleting a manual that has ever been extracted would otherwise raise a
 * foreign-key violation and the trash button would do nothing. Dropping them
 * is also the right model rather than a concession to the constraint — those
 * rows are that manual's readings, and they have no meaning once it's gone.
 *
 * Two statements, no transaction (Neon HTTP has none — `scripts/migrate.mts`).
 * Requirements first means a failure part-way loses only the extraction, which
 * re-running "Extract paint list" rebuilds.
 */
export async function deleteKitManual(id: number, kitId: number): Promise<{ blobUrl: string } | null> {
  await db
    .delete(kitPaintRequirement)
    .where(and(eq(kitPaintRequirement.kitId, kitId), eq(kitPaintRequirement.manualId, id)));

  const rows = await db
    .delete(kitManual)
    .where(and(eq(kitManual.id, id), eq(kitManual.kitId, kitId)))
    .returning({ blobUrl: kitManual.blobUrl });
  return rows[0] ?? null;
}

/** Stamped once extraction finishes writing `kit_paint_requirement` rows for
 * this manual — the detail page's "Extracted · <date>" line. */
export async function markManualPaintsExtracted(id: number, kitId: number): Promise<void> {
  await db
    .update(kitManual)
    .set({ paintsExtractedAt: new Date() })
    .where(and(eq(kitManual.id, id), eq(kitManual.kitId, kitId)));
}
