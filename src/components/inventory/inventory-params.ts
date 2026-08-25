export type InventorySearchParams = Record<string, string | string[] | undefined>;

export type SortColumn = "paint" | "family" | "state";
export type SortDirection = "asc" | "desc";

export interface InventoryParams {
  family: string | null;
  low: boolean;
  sort: SortColumn | null;
  dir: SortDirection;
}

const SORT_COLUMNS: readonly SortColumn[] = ["paint", "family", "state"];

function isSortColumn(value: unknown): value is SortColumn {
  return typeof value === "string" && (SORT_COLUMNS as readonly string[]).includes(value);
}

/**
 * Every filter and sort on this screen lives in the URL, not in client state
 * — docs/PERFORMANCE.md §6. A filter pill or a column header is a real
 * destination the router can prefetch while it's merely hovered, and
 * "flat paints, running low, by state" is a link you can come back to.
 */
export function readInventoryParams(searchParams: InventorySearchParams): InventoryParams {
  const familyRaw = searchParams.family;
  const family = typeof familyRaw === "string" && familyRaw.trim() ? familyRaw.trim() : null;
  const low = searchParams.low === "1";
  const sort = isSortColumn(searchParams.sort) ? searchParams.sort : null;
  const dir = searchParams.dir === "desc" ? "desc" : "asc";
  return { family, low, sort, dir };
}

/**
 * Builds an `/inventory` URL from the current params plus a patch — so
 * clicking a family pill doesn't reset the sort, toggling "Running low"
 * doesn't drop the family filter, and re-sorting doesn't touch either.
 */
export function inventoryHref(current: InventoryParams, patch: Partial<InventoryParams>): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.family) params.set("family", next.family);
  if (next.low) params.set("low", "1");
  if (next.sort) {
    params.set("sort", next.sort);
    params.set("dir", next.dir);
  }
  const query = params.toString();
  return query ? `/inventory?${query}` : "/inventory";
}

/** The three-state cycle a header click drives: unsorted → ascending →
 * descending → unsorted. Clicking a different column always starts it fresh
 * at ascending. */
export function nextSortState(current: InventoryParams, column: SortColumn): Partial<InventoryParams> {
  if (current.sort !== column) return { sort: column, dir: "asc" };
  if (current.dir === "asc") return { sort: column, dir: "desc" };
  return { sort: null, dir: "asc" };
}
