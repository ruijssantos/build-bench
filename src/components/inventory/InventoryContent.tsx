import { listInventory, type InventoryItemRow } from "@/db/repositories/inventory";
import { familyChipLabel, isRunningLow, stateLabel } from "@/domain/inventory";

import { EmptyShelf } from "./EmptyShelf";
import { InventoryTable } from "./InventoryTable";
import { FilterPills, ShelfPalette, type FamilyCount } from "./ShelfSections";
import {
  readInventoryParams,
  type InventorySearchParams,
  type SortColumn,
  type SortDirection,
} from "./inventory-params";
import styles from "./Inventory.module.css";

/**
 * Everything on this screen that the database owns, behind one boundary.
 *
 * One list, read once. The chips, the filter counts and the table are all
 * views of the same 33 rows — asking for them separately would be several
 * round trips to answer one question. `listInventory()` is request-time then
 * cached (docs/PERFORMANCE.md §5), so a second visit to the shelf costs
 * nothing.
 *
 * A Server Component: none of this markup reaches the client bundle. The only
 * client code underneath is the per-row pencil, which owns an open/closed
 * boolean and nothing else — filtering, sorting, running-low and remove are
 * all links and forms.
 */
export async function InventoryContent({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const params = readInventoryParams(await searchParams);
  const items = await listInventory();

  if (items.length === 0) {
    return <EmptyShelf />;
  }

  const counts = countByFamily(items);
  const lowCount = items.filter((item) => isRunningLow(item.state)).length;

  let visible = params.family ? items.filter((item) => item.paintFamily === params.family) : items;
  if (params.low) visible = visible.filter((item) => isRunningLow(item.state));
  visible = sortItems(visible, params.sort, params.dir);

  return (
    <>
      <ShelfPalette items={items} visible={visible} params={params} />
      <FilterPills total={items.length} lowCount={lowCount} counts={counts} params={params} />
      {visible.length === 0 ? (
        <div className={styles.emptyCard}>Nothing on the shelf matches that filter.</div>
      ) : (
        <InventoryTable items={visible} params={params} />
      )}
    </>
  );
}

/** Biggest group first — the filter you reach for most is the one with the
 * most in it, and the pill row scrolls sideways on a phone. */
function countByFamily(items: { paintFamily: string | null }[]): FamilyCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const family = item.paintFamily ?? "unfiled";
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
}

/**
 * Sorts by the same label text the column shows, not the raw `family`/`state`
 * key — sorting "Flat" next to "Flat" rather than the internal `flat` string
 * is what actually groups the table the way the header promises. `null`
 * `sort` leaves the repository's own shelf order (line, then number) alone.
 */
function sortItems(
  items: InventoryItemRow[],
  sort: SortColumn | null,
  dir: SortDirection,
): InventoryItemRow[] {
  if (!sort) return items;

  const key = (item: InventoryItemRow): string => {
    switch (sort) {
      case "paint":
        return (item.paintName ?? item.paintCode).toLowerCase();
      case "family":
        return familyChipLabel(item.paintFamily).toLowerCase();
      case "state":
        return stateLabel(item.state).toLowerCase();
    }
  };

  const sorted = [...items].sort((a, b) => key(a).localeCompare(key(b)));
  return dir === "desc" ? sorted.reverse() : sorted;
}
