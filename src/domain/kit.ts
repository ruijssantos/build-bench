/**
 * Pure wishlist vocabulary — docs/PLAN.md §3.2, §3.3.
 *
 * Same reasoning as `./inventory.ts`: the schema stores `kit.category`,
 * `kit.status` and `wishlist_item.status` as free text with the allowed
 * values in a comment. This is the one place those strings become labels or
 * get validated, so the repository, the Server Actions, the resolve route
 * and the UI all agree on one vocabulary by importing it from here.
 *
 * No data, no I/O.
 */

export const KIT_CATEGORIES = [
  "cars",
  "motorcycles",
  "aircraft",
  "armour",
  "ships",
  "figures",
  "other",
] as const;
export type KitCategory = (typeof KIT_CATEGORIES)[number];

export function isKitCategory(value: unknown): value is KitCategory {
  return typeof value === "string" && (KIT_CATEGORIES as readonly string[]).includes(value);
}

const CATEGORY_LABEL: Record<KitCategory, string> = {
  cars: "Cars",
  motorcycles: "Motorcycles",
  aircraft: "Aircraft",
  armour: "Armour",
  ships: "Ships",
  figures: "Figures",
  other: "Other",
};

export function categoryLabel(category: string | null): string {
  return isKitCategory(category) ? CATEGORY_LABEL[category] : "Uncategorised";
}

/**
 * `kit.status` spans both screens this table backs — §3.3. The wishlist only
 * ever reads and writes `wishlist`; `stash`/`building`/`built` are Phase 4's,
 * but the type lives here since it's the same column.
 */
export const KIT_STATUSES = ["wishlist", "stash", "building", "built"] as const;
export type KitStatus = (typeof KIT_STATUSES)[number];

export const WISHLIST_ITEM_STATUSES = ["wanted", "bought"] as const;
export type WishlistItemStatus = (typeof WISHLIST_ITEM_STATUSES)[number];
