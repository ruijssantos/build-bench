import Link from "next/link";

import inventoryStyles from "@/components/inventory/Inventory.module.css";
import { STASH_DISPLAY_ORDER, statusLabel } from "@/domain/kit";

import { kitsHref, type KitsStatusFilter } from "./kits-params";

/**
 * All / Stash / Building / Built, with counts — the shelf's own family-pill
 * language (`Inventory.module.css`'s `.filters`/`.filterPill`), imported
 * cross-folder rather than redeclared, same precedent as `EmptyKits.tsx`
 * importing that file for its empty-state card. Links, not buttons: every
 * filter is in the URL, so it's prefetchable, shareable and back-button-able
 * (docs/PERFORMANCE.md §6).
 */
export function StatusFilterPills({
  active,
  counts,
}: {
  active: KitsStatusFilter;
  counts: Record<string, number>;
}) {
  const total = STASH_DISPLAY_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  return (
    <nav className={inventoryStyles.filters} aria-label="Filter the stash">
      <Link
        href={kitsHref(null)}
        scroll={false}
        aria-current={active === null ? "page" : undefined}
        className={`${inventoryStyles.filterPill} ${active === null ? inventoryStyles.filterPillActive : ""}`}
      >
        All ({total})
      </Link>
      {STASH_DISPLAY_ORDER.map((status) => (
        <Link
          key={status}
          href={kitsHref(status)}
          scroll={false}
          aria-current={active === status ? "page" : undefined}
          className={`${inventoryStyles.filterPill} ${active === status ? inventoryStyles.filterPillActive : ""}`}
        >
          {statusLabel(status)} ({counts[status] ?? 0})
        </Link>
      ))}
    </nav>
  );
}
