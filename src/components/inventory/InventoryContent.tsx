import { listInventory, listRecentSpraySessions } from "@/db/repositories/inventory";
import { isRunningLow } from "@/domain/inventory";

import { InventoryTable } from "./InventoryTable";
import { RecentlySprayed, RunningLow } from "./InventoryLists";
import { FamilyFilters, ShelfPalette, type FamilyCount } from "./ShelfSections";
import { readInventoryParams, type InventorySearchParams } from "./inventory-params";
import styles from "./Inventory.module.css";

/**
 * Everything on this screen that the database owns, behind one boundary.
 *
 * One list, read once. The chips, the filter counts, the running-low section
 * and the table are all views of the same 33 rows — asking for them separately
 * would be four round trips to answer one question. `listInventory()` is
 * request-time then cached (docs/PERFORMANCE.md §5), so a second visit to the
 * shelf costs nothing.
 *
 * A Server Component: none of this markup reaches the client bundle. The only
 * client code underneath is the per-row pencil, which owns an open/closed
 * boolean and nothing else.
 */
export async function InventoryContent({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const { family } = readInventoryParams(await searchParams);

  const [items, sessions] = await Promise.all([listInventory(), listRecentSpraySessions()]);

  const counts = countByFamily(items);
  const visible = family ? items.filter((item) => item.paintFamily === family) : items;
  const low = items.filter((item) => isRunningLow(item.state));

  if (items.length === 0) {
    return (
      <>
        <div className={styles.shelfArea}>
          <ShelfPalette items={items} visible={visible} family={family} />
        </div>
        <div className={styles.tableArea}>
          <div className={styles.emptyCard}>
            The shelf is empty. <code>npm run db:seed</code> imports the 33 paints from
            docs/PLAN.md §2.1; <b>Add</b> puts anything else on it.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.shelfArea}>
        <ShelfPalette items={items} visible={visible} family={family} />
      </div>

      <div className={styles.filtersArea}>
        <FamilyFilters total={items.length} counts={counts} active={family} />
      </div>

      <div className={styles.lowArea}>
        <RunningLow items={low} />
      </div>

      <div className={styles.recentArea}>
        <RecentlySprayed sessions={sessions} />
      </div>

      <div className={styles.tableArea}>
        {visible.length === 0 ? (
          <div className={styles.emptyCard}>Nothing on the shelf in that family.</div>
        ) : (
          <InventoryTable items={visible} />
        )}
      </div>
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
