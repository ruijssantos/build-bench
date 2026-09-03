import { and, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { inventoryItem, paint } from "@/db/schema";
import type { InventoryForm, InventoryState } from "@/domain/inventory";

/**
 * The paint half of feature 4 — docs/PLAN.md §3.2.
 *
 * Same two-layer shape as `./ratio-overrides.ts`:
 * `connection()` pins every read to request time so `next build` never opens a
 * database (CI has no DATABASE_URL), and `use cache` then means a screen that
 * has already been looked at costs nothing to look at again. Callers must sit
 * inside a <Suspense> boundary.
 *
 * Every read joins `paint`. That looks like it contradicts the compiled-
 * catalogue rule in docs/PERFORMANCE.md §2, and doesn't: the rule is about not
 * *paying a round trip* for reference data. Inventory is user-owned, so the
 * round trip is already happening; widening it to carry the name and hex costs
 * nothing and keeps "what's on the shelf" answerable from one result set.
 *
 * "Running low" needs no query of its own — it is `state = 'low'` on rows the
 * grid has already loaded. What it needs from this file is the mutation:
 * `updateInventoryItem` with one field, which is what the one-tap toggle calls.
 */

export interface InventoryItemRow {
  id: number;
  paintCode: string;
  form: string | null;
  decantedFrom: string | null;
  state: string | null;
  quantity: number | null;
  notes: string | null;
  updatedAt: Date | null;
  paintName: string | null;
  paintHex: string | null;
  paintFamily: string | null;
  paintLine: string | null;
  paintSizeMl: number | null;
}

/** Invalidated by every inventory write — the grid, the shelf and the counts
 * all come from one list. */
export const INVENTORY_TAG = "inventory";

/** One tag per paint code, so the Thinner Bench's ownership chip for XF-64
 * isn't evicted by an edit to TS-8. */
export function inventoryPaintTag(paintCode: string): string {
  return `inventory:${paintCode}`;
}

const ITEM_COLUMNS = {
  id: inventoryItem.id,
  paintCode: inventoryItem.paintCode,
  form: inventoryItem.form,
  decantedFrom: inventoryItem.decantedFrom,
  state: inventoryItem.state,
  quantity: inventoryItem.quantity,
  notes: inventoryItem.notes,
  updatedAt: inventoryItem.updatedAt,
  paintName: paint.name,
  paintHex: paint.hex,
  paintFamily: paint.family,
  paintLine: paint.line,
  paintSizeMl: paint.sizeMl,
};

/**
 * Shelf order: by line the way §2.1 lists them, then by the number inside the
 * code. Ordering on the code as text would file X-10 before X-2, which is not
 * how the rack looks.
 */
const SHELF_ORDER = [
  sql`case ${paint.line} when 'X' then 0 when 'XF' then 1 when 'LP' then 2 when 'TS' then 3 when 'AS' then 4 when 'PS' then 5 else 6 end`,
  sql`coalesce(nullif(regexp_replace(${inventoryItem.paintCode}, '[^0-9]', '', 'g'), '')::int, 0)`,
  inventoryItem.paintCode,
];

/** Everything on the shelf, joined to the catalogue — one round trip for the
 * grid, the colour chips, the filter counts and the running-low section. */
export async function listInventory(): Promise<InventoryItemRow[]> {
  await connection();
  return queryInventory();
}

async function queryInventory(): Promise<InventoryItemRow[]> {
  "use cache";
  cacheLife("inventory");
  cacheTag(INVENTORY_TAG);

  return db
    .select(ITEM_COLUMNS)
    .from(inventoryItem)
    .leftJoin(paint, eq(paint.code, inventoryItem.paintCode))
    .orderBy(...SHELF_ORDER);
}

/**
 * The ownership check behind "do I own this?" on the Thinner Bench.
 *
 * Returns every row for the code — a stock bottle and a jar decanted from the
 * same can are two rows, and the answer standing in a shop is about the code,
 * not about one of them.
 */
export async function getInventoryForPaint(paintCode: string): Promise<InventoryItemRow[]> {
  await connection();
  return queryInventoryForPaint(paintCode);
}

async function queryInventoryForPaint(paintCode: string): Promise<InventoryItemRow[]> {
  "use cache";
  cacheLife("inventory");
  cacheTag(inventoryPaintTag(paintCode));

  return db
    .select(ITEM_COLUMNS)
    .from(inventoryItem)
    .leftJoin(paint, eq(paint.code, inventoryItem.paintCode))
    .where(eq(inventoryItem.paintCode, paintCode))
    .orderBy(inventoryItem.id);
}

export interface CreateInventoryItemInput {
  paintCode: string;
  form: InventoryForm;
  state: InventoryState | null;
  quantity: number;
  notes: string | null;
}

/**
 * A plain INSERT, one round trip. Every caller already knows the paint code
 * it just wrote (it's the thing they were adding) — this used to fetch the
 * row straight back with a second SELECT purely to hand that code back,
 * which no caller needed since they already had it.
 */
export async function createInventoryItem(input: CreateInventoryItemInput): Promise<void> {
  await db.insert(inventoryItem).values({
    paintCode: input.paintCode,
    form: input.form,
    state: input.state,
    quantity: input.quantity,
    notes: input.notes,
    updatedAt: new Date(),
  });
}

export interface UpdateInventoryItemInput {
  form?: InventoryForm;
  state?: InventoryState | null;
  quantity?: number;
  notes?: string | null;
}

/**
 * A plain UPDATE, one round trip — see `createInventoryItem`'s note. This
 * used to follow the UPDATE with a full SELECT + `paint` join just to return
 * `paintCode` for cache invalidation; every caller already has it (it's on
 * the row being edited), so that second round trip was pure overhead on
 * every single "mark running low" tap.
 */
/** Returns whether a row was actually there to update — the same signal every
 * kit and wishlist mutation gives, so an edit submitted against a shelf entry
 * that has since been removed says so instead of reporting success. */
export async function updateInventoryItem(id: number, patch: UpdateInventoryItemInput): Promise<boolean> {
  const rows = await db
    .update(inventoryItem)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(inventoryItem.id, id))
    .returning({ id: inventoryItem.id });
  return rows.length > 0;
}

/**
 * A DELETE with `returning()`, still one round trip — this is the one
 * mutation that has a real reason to ask the database something (did a row
 * actually exist to delete?), and Postgres's own RETURNING clause answers
 * that in the same statement rather than costing a separate pre-read.
 */
export async function deleteInventoryItem(id: number): Promise<boolean> {
  const rows = await db
    .delete(inventoryItem)
    .where(eq(inventoryItem.id, id))
    .returning({ id: inventoryItem.id });
  return rows.length > 0;
}

/**
 * Which of these paint codes are on the shelf at all — the Stash detail
 * page's Owned/Missing split (docs/PLAN.md §6 Phase 4a). A `Set`, not the
 * full rows: the caller only ever asks "is this code owned", never "by which
 * shelf row", and a code with several rows (a spray can and the jar decanted
 * from it) should answer that question once, not once per row.
 */
export async function listOwnedPaintCodes(codes: string[]): Promise<Set<string>> {
  await connection();
  return queryOwnedPaintCodes(codes);
}

async function queryOwnedPaintCodes(codes: string[]): Promise<Set<string>> {
  "use cache";
  cacheLife("inventory");
  cacheTag(INVENTORY_TAG);

  if (codes.length === 0) return new Set();

  const rows = await db
    .selectDistinct({ paintCode: inventoryItem.paintCode })
    .from(inventoryItem)
    .where(inArray(inventoryItem.paintCode, codes));
  return new Set(rows.map((row) => row.paintCode));
}

/** Guards the Add flow against a second row for the same code in the same
 * form — one bottle of XF-64 is a quantity, not two shelf entries. */
export async function findInventoryItem(
  paintCode: string,
  form: InventoryForm,
): Promise<InventoryItemRow | undefined> {
  const rows = await db
    .select(ITEM_COLUMNS)
    .from(inventoryItem)
    .leftJoin(paint, eq(paint.code, inventoryItem.paintCode))
    .where(and(eq(inventoryItem.paintCode, paintCode), eq(inventoryItem.form, form)))
    .limit(1);
  return rows[0];
}
