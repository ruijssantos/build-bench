import Link from "next/link";

import type { InventoryItemRow } from "@/db/repositories/inventory";
import { familyChipLabel } from "@/domain/inventory";

import { inventoryHref, type InventoryParams } from "./inventory-params";
import styles from "./Inventory.module.css";

/**
 * The shelf, as colour.
 *
 * The chips are `paint.hex` — content, not decoration (the canvas note on the
 * design reference makes the point: 33 saturated chips work precisely because
 * nothing else on the screen competes with them). Each one is a link to that
 * paint's ratio, which is what you want from a colour you just spotted.
 *
 * A filter dims the chips it excludes rather than removing them: the shelf is
 * the whole shelf, and seeing what a filter leaves out is half of reading it.
 *
 * Only called once the caller knows `items` isn't empty — see `EmptyShelf`
 * for the true empty state.
 */
export function ShelfPalette({
  items,
  visible,
  params,
}: {
  items: InventoryItemRow[];
  visible: InventoryItemRow[];
  params: InventoryParams;
}) {
  const shown = new Set(visible.map((item) => item.id));
  const filtered = params.family !== null || params.low;

  return (
    <div className={styles.shelfCard}>
      <div className={styles.shelfHead}>
        <span className={styles.moduleTitle}>Your shelf</span>
        <span className={styles.shelfCount}>
          {filtered ? `${visible.length} of ${items.length}` : `${items.length} paints`}
        </span>
      </div>

      <div className={styles.chipGrid}>
        {items.map((item) => (
          <Link
            key={item.id}
            className={`${styles.chip} ${shown.has(item.id) ? "" : styles.chipMuted}`}
            style={{ background: item.paintHex ?? "#c7c9d1" }}
            href={`/thinner?code=${encodeURIComponent(item.paintCode)}`}
            title={`${item.paintCode} ${item.paintName ?? ""}`.trim()}
            aria-label={`${item.paintCode} ${item.paintName ?? ""}`.trim()}
          />
        ))}
      </div>
    </div>
  );
}

export interface FamilyCount {
  family: string;
  count: number;
}

/**
 * The pill row: All, Running low, then the family breakdown.
 *
 * The design reference draws family counts as "Gloss 18 · Flat 11 · Spray 2"
 * — which are the Google Sheet's own column headings, i.e. line prefixes.
 * §2.1 is explicit that the importer files paints by catalogue family
 * instead, so X-19 and the clears land under Clear and X-21 under Additive,
 * and these counts don't match the mockup's. That is the plan working, not
 * drifting from it: the family is what decides the ratio, so it's what the
 * shelf should be sliceable by.
 *
 * "Running low" used to be its own module, always visible whether or not
 * anything was low. As a pill it's just another slice of the same table —
 * consistent with every other filter here — and it earns the one different
 * treatment on this row (alert colour, not accent) because it's the one
 * filter that means "something needs attention," not just "a subset."
 *
 * Links, not buttons — every filter is in the URL, so it's prefetchable,
 * shareable and back-button-able (docs/PERFORMANCE.md §6).
 */
export function FilterPills({
  total,
  lowCount,
  counts,
  params,
}: {
  total: number;
  lowCount: number;
  counts: FamilyCount[];
  params: InventoryParams;
}) {
  return (
    <nav className={styles.filters} aria-label="Filter the shelf">
      <Link
        href={inventoryHref(params, { family: null })}
        scroll={false}
        aria-current={params.family === null ? "page" : undefined}
        className={`${styles.filterPill} ${params.family === null ? styles.filterPillActive : ""}`}
      >
        All ({total})
      </Link>

      <Link
        href={inventoryHref(params, { low: !params.low })}
        scroll={false}
        aria-pressed={params.low}
        className={`${styles.filterPillAlert} ${params.low ? styles.filterPillAlertActive : ""}`}
      >
        Running low ({lowCount})
      </Link>

      {counts.map(({ family, count }) => (
        <Link
          key={family}
          href={inventoryHref(params, { family })}
          scroll={false}
          aria-current={params.family === family ? "page" : undefined}
          className={`${styles.filterPill} ${params.family === family ? styles.filterPillActive : ""}`}
        >
          {familyChipLabel(family)} ({count})
        </Link>
      ))}
    </nav>
  );
}
