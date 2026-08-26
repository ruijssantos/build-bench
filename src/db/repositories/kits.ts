import { and, desc, eq, sql } from "drizzle-orm";
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

/** Returns the new row's id so the caller can patch `image_url` in later —
 * box art is fetched after the response, not inside the save (see
 * `saveKitCandidate`). */
export async function createKit(input: CreateKitInput): Promise<number> {
  const rows = await db
    .insert(kit)
    .values({ ...input, createdAt: new Date() })
    .returning({ id: kit.id });
  return rows[0].id;
}

/**
 * Every mutation below is scoped by `status` as well as `id`.
 *
 * The wishlist and the stash share this table (§3.3), so an id alone is not
 * an authorisation to touch a row: without the status predicate a stale tab,
 * a replayed form post or an id typo on the wishlist screen would happily
 * delete a kit Phase 4 has already stashed, built, or hung manuals and
 * research off. The screen may only act on rows the screen actually shows.
 */
export async function updateKitStatus(id: number, from: KitStatus, to: KitStatus): Promise<boolean> {
  const rows = await db
    .update(kit)
    .set({ status: to })
    .where(and(eq(kit.id, id), eq(kit.status, from)))
    .returning({ id: kit.id });
  return rows.length > 0;
}

/** Deletes only within `status`, and returns the removed row's `image_url`
 * so the caller can drop the blob it was the last reference to. */
export async function deleteKit(id: number, status: KitStatus): Promise<{ imageUrl: string | null } | null> {
  const rows = await db
    .delete(kit)
    .where(and(eq(kit.id, id), eq(kit.status, status)))
    .returning({ imageUrl: kit.imageUrl });
  return rows[0] ?? null;
}

export async function updateKitImage(id: number, imageUrl: string): Promise<void> {
  await db.update(kit).set({ imageUrl }).where(eq(kit.id, id));
}

/**
 * The duplicate guard behind saving a candidate — the wishlist equivalent of
 * `findInventoryItem`. Brand plus kit number is a kit's identity, and saving
 * the same one twice from two searches is the same mistake as adding a second
 * shelf row for one bottle of XF-64.
 *
 * Case-insensitive: "tamiya" and "Tamiya" are one brand. Only meaningful
 * where a kit number exists — two kits from one brand with no number between
 * them aren't provably the same kit, so those are left alone.
 *
 * `lower(...)` rather than `ilike`: this is an equality test, and `ilike`
 * would read `%` and `_` in a brand or kit number as wildcards — a false
 * match there blocks a save that should have gone through.
 */
export async function findWishlistKit(brand: string, kitNumber: string): Promise<KitRow | undefined> {
  const rows = await db
    .select()
    .from(kit)
    .where(
      and(
        eq(kit.status, "wishlist"),
        sql`lower(${kit.brand}) = ${brand.toLowerCase()}`,
        sql`lower(${kit.kitNumber}) = ${kitNumber.toLowerCase()}`,
      ),
    )
    .limit(1);
  return rows[0];
}
