import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { kit } from "@/db/schema";
import type { KitCategory, KitStatus } from "@/domain/kit";

/**
 * The `kit` table — docs/PLAN.md §3.2, §3.3. One table backs both the
 * wishlist (`status = 'wishlist'`, this phase) and the stash
 * (`stash`/`building`/`built`, Phase 4), so this repository is written
 * generically over `status` rather than wishlist-only, even though nothing
 * in this phase reads anything but `wishlist`.
 *
 * Same two-layer shape as `./inventory.ts`: `connection()` pins reads to
 * request time so `next build` never opens a database, and `use cache` then
 * means a screen that's already been looked at costs nothing to look at
 * again. Callers must sit inside a <Suspense> boundary.
 */

export interface KitRow {
  id: number;
  brand: string | null;
  kitNumber: string | null;
  name: string | null;
  scale: string | null;
  category: string | null;
  status: string;
  scalematesUrl: string | null;
  imageUrl: string | null;
  notes: string | null;
  createdAt: Date | null;
}

/** Invalidated by every kit write. One tag for the whole table, same call as
 * `INVENTORY_TAG` — the wishlist grid and (from Phase 4) the stash both read
 * off `status`, not off separate rows, so there's nothing narrower to tag. */
export const KIT_TAG = "kit";

export async function listKitsByStatus(status: KitStatus): Promise<KitRow[]> {
  await connection();
  return queryKitsByStatus(status);
}

async function queryKitsByStatus(status: KitStatus): Promise<KitRow[]> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(KIT_TAG);

  return db.select().from(kit).where(eq(kit.status, status)).orderBy(desc(kit.createdAt));
}

export interface CreateKitInput {
  brand: string;
  kitNumber: string | null;
  name: string;
  scale: string | null;
  category: KitCategory;
  status: KitStatus;
  scalematesUrl: string | null;
  imageUrl: string | null;
  notes: string | null;
}

export async function createKit(input: CreateKitInput): Promise<void> {
  await db.insert(kit).values({ ...input, createdAt: new Date() });
}

/** The one-tap "mark bought" on a wishlist kit card — `status: wishlist →
 * stash`, the single-column write §3.3 designs the whole table around. */
export async function updateKitStatus(id: number, status: KitStatus): Promise<boolean> {
  const rows = await db.update(kit).set({ status }).where(eq(kit.id, id)).returning({ id: kit.id });
  return rows.length > 0;
}

export async function deleteKit(id: number): Promise<boolean> {
  const rows = await db.delete(kit).where(eq(kit.id, id)).returning({ id: kit.id });
  return rows.length > 0;
}
