import { and, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { kit } from "@/db/schema";
import type { KitCategory, KitStatus } from "@/domain/kit";

/**
 * The `kit` table — docs/PLAN.md §3.2, §3.3. One table backs the wishlist
 * (`status = 'wishlist'`, Phase 3) and the stash (`stash`/`building`/`built`,
 * Phase 4a), so this repository is written generically over `status`
 * throughout rather than assuming either screen.
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
  purchasedFrom: string | null;
  purchasedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: Date | null;
}

/** Invalidated by every kit write. One tag for the whole table — every
 * screen that lists kits by status reads off `status`, not off separate
 * rows, so there's nothing narrower to tag for a *list*. A single kit's own
 * detail page additionally tags on `kitTag(id)` (below), so editing one
 * kit's manuals doesn't evict every other kit's cached detail read. */
export const KIT_TAG = "kit";

/** Per-kit tag for the detail page and its sub-resources (manuals, paint
 * requirements) — narrower than `KIT_TAG` so uploading a manual to kit #12
 * doesn't invalidate every other kit's already-cached detail read. */
export function kitTag(id: number): string {
  return `kit:${id}`;
}

export async function listKitsByStatuses(statuses: KitStatus[]): Promise<KitRow[]> {
  await connection();
  return queryKitsByStatuses(statuses);
}

async function queryKitsByStatuses(statuses: KitStatus[]): Promise<KitRow[]> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(KIT_TAG);

  return db
    .select()
    .from(kit)
    .where(inArray(kit.status, statuses))
    .orderBy(sql`${kit.createdAt} desc`);
}

/** How many kits sit in each of these statuses — the Stash screen's filter
 * pills, which always show every pill's count regardless of which one is
 * active. A separate, cheap query rather than deriving it from whichever
 * filtered list happens to be loaded, since a specific filter's own fetch
 * only ever returns rows for that one status. */
export async function countKitsByStatus(statuses: KitStatus[]): Promise<Record<string, number>> {
  await connection();
  return queryCountKitsByStatus(statuses);
}

async function queryCountKitsByStatus(statuses: KitStatus[]): Promise<Record<string, number>> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(KIT_TAG);

  const rows = await db
    .select({ status: kit.status, count: sql<number>`count(*)` })
    .from(kit)
    .where(inArray(kit.status, statuses))
    .groupBy(kit.status);

  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
}

/** One kit by id, any status — the detail page's own read. Cached and
 * request-time, same shape as `listKitsByStatuses`; a wishlist-status kit
 * reads back fine here too; the detail page itself treats that as
 * not-found, since the wishlist screen (not this one) owns that status. */
export async function getKitById(id: number): Promise<KitRow | undefined> {
  await connection();
  return queryKitById(id);
}

async function queryKitById(id: number): Promise<KitRow | undefined> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(KIT_TAG);
  cacheTag(kitTag(id));

  const rows = await db.select().from(kit).where(eq(kit.id, id)).limit(1);
  return rows[0];
}

/**
 * One row by id, unscoped by status — used ahead of a mutation to learn a
 * kit's *current* status (which the mutation itself then uses as its own
 * predicate — see `updateKitImage` and friends below). Uncached, since every
 * caller is about to write and needs a fresh read, not a request-cached one.
 */
export async function findKitById(id: number): Promise<KitRow | undefined> {
  const rows = await db.select().from(kit).where(eq(kit.id, id)).limit(1);
  return rows[0];
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
 * a replayed form post or an id typo would happily act on a kit that has
 * since moved screens — deleted a kit Phase 4a has already stashed, built,
 * or hung manuals and paint requirements off. The screen may only act on
 * rows it actually shows *as of the status it just read*, which is why every
 * caller here re-reads the row (`findKitById`, above) immediately before
 * writing rather than trusting a status the client sent.
 */
export async function updateKitStatus(id: number, from: KitStatus, to: KitStatus): Promise<boolean> {
  const rows = await db
    .update(kit)
    .set({
      status: to,
      // Stamped once, on the transition in — `coalesce` so a kit that was
      // already started (moved back to stash, then forward again) doesn't
      // have its original date overwritten. Editable after via
      // `updateKitPurchase`, which is the escape hatch for backfilling or
      // correcting either date by hand.
      ...(to === "building" ? { startedAt: sql`coalesce(${kit.startedAt}, current_date)` } : {}),
      ...(to === "built" ? { completedAt: sql`coalesce(${kit.completedAt}, current_date)` } : {}),
    })
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

/** Art editing (docs/PLAN.md §6 Phase 4a adds it on the detail page) is
 * exactly the call site that made this exploitable before: fixed to carry
 * the same `and(id, status)` predicate as every other mutation here rather
 * than being the one write in this file with none. */
export async function updateKitImage(id: number, status: KitStatus, imageUrl: string): Promise<boolean> {
  const rows = await db
    .update(kit)
    .set({ imageUrl })
    .where(and(eq(kit.id, id), eq(kit.status, status)))
    .returning({ id: kit.id });
  return rows.length > 0;
}

export interface UpdateKitInput {
  brand: string;
  kitNumber: string | null;
  name: string;
  scale: string | null;
  category: KitCategory;
  scalematesUrl: string | null;
  notes: string | null;
  /** Only set when the edit uploaded a new photo — omitted leaves the
   * existing `image_url` (or lack of one) alone. */
  imageUrl?: string;
}

/** Edits a kit's identity fields in place — same status scoping as every
 * other mutation here (see the note above `updateKitStatus`). */
export async function updateKit(id: number, status: KitStatus, input: UpdateKitInput): Promise<boolean> {
  const rows = await db
    .update(kit)
    .set({
      brand: input.brand,
      kitNumber: input.kitNumber,
      name: input.name,
      scale: input.scale,
      category: input.category,
      scalematesUrl: input.scalematesUrl,
      notes: input.notes,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    })
    .where(and(eq(kit.id, id), eq(kit.status, status)))
    .returning({ id: kit.id });
  return rows.length > 0;
}

export interface UpdateKitPurchaseInput {
  purchasedFrom: string | null;
  /** "YYYY-MM-DD" or `null` to clear. */
  purchasedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** The detail page's Purchase & dates panel — plumbing only (docs/PLAN.md §6
 * Phase 4a: the columns already existed, this is what finally writes them).
 * Same status scoping as every mutation above. */
export async function updateKitPurchase(
  id: number,
  status: KitStatus,
  input: UpdateKitPurchaseInput,
): Promise<boolean> {
  const rows = await db
    .update(kit)
    .set(input)
    .where(and(eq(kit.id, id), eq(kit.status, status)))
    .returning({ id: kit.id });
  return rows.length > 0;
}

/**
 * The duplicate guard behind saving a kit — parameterised over no status at
 * all: it searches every status, because the useful answer to "is this kit
 * already here" is "yes, on your wishlist" just as much as "yes, in your
 * stash." A caller that finds a hit outside the status it's about to save
 * into can offer to *promote* the existing row instead of creating a second
 * one (docs/PLAN.md §6 Phase 4a) — the row's own `status` is right there to
 * decide that with.
 *
 * Case-insensitive: "tamiya" and "Tamiya" are one brand. Only meaningful
 * where a kit number exists — two kits from one brand with no number between
 * them aren't provably the same kit, so those are left alone.
 *
 * `lower(...)` rather than `ilike`: this is an equality test, and `ilike`
 * would read `%` and `_` in a brand or kit number as wildcards — a false
 * match there blocks a save that should have gone through.
 */
export async function findKitByBrandNumber(brand: string, kitNumber: string): Promise<KitRow | undefined> {
  const rows = await db
    .select()
    .from(kit)
    .where(
      and(
        sql`lower(${kit.brand}) = ${brand.toLowerCase()}`,
        sql`lower(${kit.kitNumber}) = ${kitNumber.toLowerCase()}`,
      ),
    )
    .limit(1);
  return rows[0];
}
