import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { inventoryItem, kit, kitPaintRequirement } from "@/db/schema";

import { INVENTORY_TAG } from "./inventory";
import { KIT_REQUIREMENTS_TAG, } from "./kit-paint-requirements";
import { KIT_TAG } from "./kits";

/**
 * "Next shop run" — the Dashboard's one genuinely new query (docs/PLAN.md
 * §6 Phase 6): every paint code called for by a kit you are building or
 * about to build that isn't on the shelf, rolled up across kits.
 *
 * This is the derived view the persisted `shopping_list_item` table was
 * dropped for (§7, §8): the answer is a join away from data three phases
 * already maintain, so there is nothing to keep in sync and nothing to tick
 * stale.
 *
 * `built` is deliberately excluded from the statuses below, unlike
 * `getStashReadiness`'s all-of-STASH_STATUSES: a finished kit's missing
 * paints are a historical fact, not a shopping list. Only `stash` and
 * `building` describe paint you still need to buy.
 */

const NEEDED_STATUSES = ["stash", "building"] as const;

export interface ShopRunPaint {
  paintCode: string;
  /** How many not-yet-finished kits call for it — "· 2 kits" on the row. */
  kitCount: number;
}

export async function listShopRunPaints(): Promise<ShopRunPaint[]> {
  await connection();
  return queryShopRunPaints();
}

async function queryShopRunPaints(): Promise<ShopRunPaint[]> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(KIT_TAG);
  cacheTag(KIT_REQUIREMENTS_TAG);
  cacheTag(INVENTORY_TAG);

  // The left join + `is null` is an anti-join: keep requirement rows that
  // found no matching shelf row. Counting *distinct* kit ids matters for the
  // same reason `getStashReadiness` counts distinct codes — one code can be
  // called out on several parts of the same manual, and that is one kit, not
  // three.
  const rows = await db
    .select({
      paintCode: kitPaintRequirement.paintCode,
      kitCount: sql<number>`count(distinct ${kitPaintRequirement.kitId})`,
    })
    .from(kitPaintRequirement)
    .innerJoin(kit, eq(kit.id, kitPaintRequirement.kitId))
    .leftJoin(inventoryItem, eq(inventoryItem.paintCode, kitPaintRequirement.paintCode))
    .where(
      and(
        inArray(kit.status, [...NEEDED_STATUSES]),
        isNotNull(kitPaintRequirement.paintCode),
        isNull(inventoryItem.paintCode),
      ),
    )
    .groupBy(kitPaintRequirement.paintCode);

  return rows
    .filter((row): row is { paintCode: string; kitCount: number } => row.paintCode !== null)
    .map((row) => ({ paintCode: row.paintCode, kitCount: Number(row.kitCount) }));
}
