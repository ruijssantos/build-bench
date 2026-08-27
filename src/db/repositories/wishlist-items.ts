import { desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { wishlistItem } from "@/db/schema";
import type { WishlistItemStatus } from "@/domain/kit";

/**
 * The `wishlist_item` table — docs/PLAN.md §3.2. The wishlist's "Other
 * items": tools and supplies, deliberately not a `kit` row with empty
 * columns (§3.3). Same two-layer shape as `./kits.ts` and `./inventory.ts`.
 */

export interface WishlistItemRow {
  id: number;
  title: string;
  url: string | null;
  notes: string | null;
  status: string;
  addedAt: Date | null;
}

export const WISHLIST_ITEMS_TAG = "wishlist-items";

/** Wanted first, then bought — a tick moves an item to the back of its own
 * list rather than out of view. Newest first within each. */
const ITEM_ORDER = [sql`case ${wishlistItem.status} when 'wanted' then 0 else 1 end`, desc(wishlistItem.addedAt)];

export async function listWishlistItems(): Promise<WishlistItemRow[]> {
  await connection();
  return queryWishlistItems();
}

async function queryWishlistItems(): Promise<WishlistItemRow[]> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(WISHLIST_ITEMS_TAG);

  return db.select().from(wishlistItem).orderBy(...ITEM_ORDER);
}

export interface CreateWishlistItemInput {
  title: string;
  url: string | null;
  notes: string | null;
}

export async function createWishlistItem(input: CreateWishlistItemInput): Promise<void> {
  await db.insert(wishlistItem).values({ ...input, status: "wanted", addedAt: new Date() });
}

export interface UpdateWishlistItemInput {
  title: string;
  url: string | null;
  notes: string | null;
}

export async function updateWishlistItem(id: number, input: UpdateWishlistItemInput): Promise<boolean> {
  const rows = await db
    .update(wishlistItem)
    .set(input)
    .where(eq(wishlistItem.id, id))
    .returning({ id: wishlistItem.id });
  return rows.length > 0;
}

export async function updateWishlistItemStatus(id: number, status: WishlistItemStatus): Promise<boolean> {
  const rows = await db
    .update(wishlistItem)
    .set({ status })
    .where(eq(wishlistItem.id, id))
    .returning({ id: wishlistItem.id });
  return rows.length > 0;
}

export async function deleteWishlistItem(id: number): Promise<boolean> {
  const rows = await db.delete(wishlistItem).where(eq(wishlistItem.id, id)).returning({ id: wishlistItem.id });
  return rows.length > 0;
}
