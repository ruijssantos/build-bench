export type InventorySearchParams = Record<string, string | string[] | undefined>;

/**
 * The shelf filter lives in the URL, not in client state — docs/PERFORMANCE.md
 * §6. Each filter pill is a real destination the router can prefetch while
 * it's merely hovered, and "flat paints only" is a link you can come back to.
 */
export function readInventoryParams(searchParams: InventorySearchParams): { family: string | null } {
  const raw = searchParams.family;
  const family = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  return { family };
}

export function inventoryHref(family: string | null): string {
  return family ? `/inventory?family=${encodeURIComponent(family)}` : "/inventory";
}
