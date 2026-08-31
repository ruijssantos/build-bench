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

/** The Stash screen's three statuses, in *progression* order — this is the
 * order the detail page's stepper walks, and the order `nextStashStatus` /
 * `previousStashStatus` step through. `wishlist` never reaches this screen
 * (§3.3: buying is one-directional, Phase 3's job, not this one's). */
export const STASH_STATUSES = ["stash", "building", "built"] as const;
export type StashStatus = (typeof STASH_STATUSES)[number];

/**
 * The same three statuses in *attention* order, which is not the same thing.
 *
 * The stepper has to read stash → building → built, because that's the road a
 * kit travels. A list has no such obligation, and sorting it that way buries
 * the one thing worth seeing first: what's actually on the bench right now.
 * So the grid and the filter pills lead with Building, then Stash (what could
 * be started next), then Built (a finished shelf, browsed rather than worked).
 */
export const STASH_DISPLAY_ORDER = ["building", "stash", "built"] as const;

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

/**
 * Where a kit already is, as a phrase that finishes "That kit is already …".
 *
 * `statusLabel` alone doesn't survive being spliced into a sentence: "Stash"
 * is a noun, "Building" and "Built" are adjectives, so a lowercased label
 * produces "already in your building." Each status gets its own phrasing
 * instead.
 */
const STATUS_PHRASE: Record<KitStatus, string> = {
  wishlist: "on your wishlist",
  stash: "in your stash",
  building: "being built",
  built: "built",
};

export function statusPhrase(status: string | null): string {
  return isKitStatus(status) ? STATUS_PHRASE[status] : "already here";
}

/** The empty-state line for a status filter that matched nothing — same
 * problem as `statusPhrase`, different sentence ("No kits are …"). */
const STATUS_EMPTY: Record<StashStatus, string> = {
  stash: "No kits are sitting in the stash right now.",
  building: "No kits are being built right now.",
  built: "No kits are finished yet.",
};

export function statusEmptyLine(status: StashStatus): string {
  return STATUS_EMPTY[status];
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
