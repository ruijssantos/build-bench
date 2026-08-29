import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { kitManual } from "@/db/schema";

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

export async function deleteKitManual(id: number, kitId: number): Promise<{ blobUrl: string } | null> {
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
