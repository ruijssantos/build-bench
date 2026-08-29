import type { ReactNode } from "react";

import { getStashReadiness, type KitReadiness } from "@/db/repositories/kit-paint-requirements";
import { listKitsByStatuses, type KitRow } from "@/db/repositories/kits";
import type { KitStatus } from "@/domain/kit";

import styles from "./Wishlist.module.css";

/**
 * The saved half of the Kits module — everything the database owns here,
 * behind one boundary (docs/PERFORMANCE.md §5). Shared by the Wishlist and
 * the Stash: `statuses` picks which rows, `renderCard` picks how each one
 * renders (`SavedKitCard` for the wishlist, `StashKitCard` for the stash),
 * and `emptyState` is shown in place of the grid when there's nothing to
 * list. `withReadiness` additionally fetches the Stash's "N of M · K to buy"
 * aggregate (`getStashReadiness` — one query across every kit, not N+1) and
 * hands each card its own row from it; the Wishlist has no paint list to be
 * ready against, so it never asks for this.
 *
 * `listKitsByStatuses` is request-time then cached, so a second visit costs
 * nothing.
 */
export async function SavedKitsGrid({
  statuses,
  moduleLabel,
  withReadiness = false,
  emptyState,
  renderCard,
}: {
  statuses: KitStatus[];
  moduleLabel: string;
  withReadiness?: boolean;
  emptyState: ReactNode;
  renderCard: (kit: KitRow, priority: boolean, readiness: KitReadiness | undefined) => ReactNode;
}) {
  const [kits, readinessRows] = await Promise.all([
    listKitsByStatuses(statuses),
    withReadiness ? getStashReadiness() : Promise.resolve([]),
  ]);

  if (kits.length === 0) {
    return emptyState;
  }

  const readinessByKit = new Map(readinessRows.map((row) => [row.kitId, row]));

  return (
    <>
      <div className={styles.subHead}>
        <span className={styles.moduleTitle}>
          {moduleLabel} ({kits.length})
        </span>
      </div>
      <div className={styles.cardGrid}>
        {kits.map((kit, index) =>
          // The first card is this screen's LCP element on a cold load —
          // see KitArt. Everything after it keeps the ordinary lazy path.
          renderCard(kit, index === 0, readinessByKit.get(kit.id)),
        )}
      </div>
    </>
  );
}
