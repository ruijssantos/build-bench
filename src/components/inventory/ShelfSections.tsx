import Link from "next/link";

import type { InventoryItemRow } from "@/db/repositories/inventory";
import { familyChipLabel } from "@/domain/inventory";

import { inventoryHref } from "./inventory-params";
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
 */
export function ShelfPalette({
  items,
  visible,
  family,
}: {
  items: InventoryItemRow[];
  visible: InventoryItemRow[];
  family: string | null;
}) {
  const shown = new Set(visible.map((item) => item.id));

  return (
    <div className={styles.shelfCard}>
      <div className={styles.shelfHead}>
        <span className={styles.moduleTitle}>Your shelf</span>
        <span className={styles.shelfCount}>
          {family ? `${visible.length} of ${items.length}` : `${items.length} paints`}
        </span>
      </div>

      {items.length === 0 ? (
        <p className={styles.chipEmpty}>
          Nothing on the shelf yet — run <code>npm run db:seed</code> to import the sheet, or add a
          paint by hand.
        </p>
      ) : (
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
      )}
    </div>
  );
}

export interface FamilyCount {
  family: string;
  count: number;
}

/**
 * Filter pills, by ratio family.
 *
 * The design reference draws these as "Gloss 18 · Flat 11 · Spray 2" — which
 * are the Google Sheet's own column headings, i.e. line prefixes. §2.1 is
 * explicit that the importer files paints by catalogue family instead, so
 * X-19 and the clears land under Clear and X-21 under Additive, and these
 * counts don't match the mockup's. That is the plan working, not drifting
 * from it: the family is what decides the ratio, so it's what the shelf
 * should be sliceable by.
 *
 * Links, not buttons — the filter is in the URL, so it's prefetchable,
 * shareable and back-button-able (docs/PERFORMANCE.md §6).
 */
export function FamilyFilters({
  total,
  counts,
  active,
}: {
  total: number;
  counts: FamilyCount[];
  active: string | null;
}) {
  return (
    <nav className={styles.filters} aria-label="Filter by family">
      <Link
        href={inventoryHref(null)}
        scroll={false}
        aria-current={active === null ? "page" : undefined}
        className={`${styles.filterPill} ${active === null ? styles.filterPillActive : ""}`}
      >
        All {total}
      </Link>
      {counts.map(({ family, count }) => (
        <Link
          key={family}
          href={inventoryHref(family)}
          scroll={false}
          aria-current={active === family ? "page" : undefined}
          className={`${styles.filterPill} ${active === family ? styles.filterPillActive : ""}`}
        >
          {familyChipLabel(family)} {count}
        </Link>
      ))}
    </nav>
  );
}
