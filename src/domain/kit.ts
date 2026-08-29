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

export function isKitStatus(value: unknown): value is KitStatus {
  return typeof value === "string" && (KIT_STATUSES as readonly string[]).includes(value);
}

/** The Stash screen's three statuses, in the order the stepper on the detail
 * page shows them — `wishlist` never reaches this screen (§3.3: buying is
 * one-directional, Phase 3's job, not this one's). */
export const STASH_STATUSES = ["stash", "building", "built"] as const;
export type StashStatus = (typeof STASH_STATUSES)[number];

export function isStashStatus(value: unknown): value is StashStatus {
  return typeof value === "string" && (STASH_STATUSES as readonly string[]).includes(value);
}

const STATUS_LABEL: Record<KitStatus, string> = {
  wishlist: "Wishlist",
  stash: "Stash",
  building: "Building",
  built: "Built",
};

export function statusLabel(status: string | null): string {
  return isKitStatus(status) ? STATUS_LABEL[status] : "Unknown";
}

/** The forward step `updateKitStatus(id, from, to)` takes from the Stash
 * screen's status stepper and the list card's one-tap advance — `null` once
 * a kit is `built`, there being nowhere further forward to go. */
export function nextStashStatus(status: StashStatus): StashStatus | null {
  if (status === "stash") return "building";
  if (status === "building") return "built";
  return null;
}

/** The stepper's quiet "move back" escape hatch — the reverse of
 * `nextStashStatus`. `null` at `stash`, the bottom of this screen's ladder;
 * moving further back is `wishlist`, which is Phase 3's one-directional
 * "mark bought" and not undone from here. */
export function previousStashStatus(status: StashStatus): StashStatus | null {
  if (status === "built") return "building";
  if (status === "building") return "stash";
  return null;
}

/**
 * The detail page's "Search YouTube" link — the free part of §5.1's kit
 * research this phase ships (deep research with a real build video is
 * Phase 4b). Built exactly the way `paintSearchUrl` in `src/domain/
 * inventory.ts` builds its shop link: a plain search URL, no API, no key to
 * manage.
 */
export function kitYoutubeSearchUrl(brand: string | null, kitNumber: string | null, name: string | null): string {
  const query = [brand, kitNumber, name, "build"].filter(Boolean).join(" ").trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export const WISHLIST_ITEM_STATUSES = ["wanted", "bought"] as const;
export type WishlistItemStatus = (typeof WISHLIST_ITEM_STATUSES)[number];
