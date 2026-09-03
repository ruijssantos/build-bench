import Link from "next/link";

import cardStyles from "@/components/wishlist/Wishlist.module.css";
import { getStashReadiness } from "@/db/repositories/kit-paint-requirements";
import { listKitsByStatuses } from "@/db/repositories/kits";
import { isReadyToBuild } from "@/domain/dashboard";

import { KitThumb } from "./KitThumb";
import styles from "./Dashboard.module.css";

/** How many to list before deferring to the Stash screen. A dashboard module
 * is a prompt, not an index — past a handful it stops being scannable and the
 * filtered Stash is the better surface. */
const MAX_ROWS = 4;

/**
 * Stashed kits whose every called-for paint is already on the shelf —
 * docs/PLAN.md §6 Phase 6. The module that turns the Dashboard from a readout
 * into a decision: what could I start tonight without a shop run.
 *
 * `isReadyToBuild` is deliberately strict about a kit with no extracted paint
 * list — that kit is *unknown*, not ready, and showing it here would make the
 * one claim this module exists to make untrue.
 */
export async function ReadyToBuild() {
  const [kits, readiness] = await Promise.all([listKitsByStatuses(["stash"]), getStashReadiness()]);

  const byKit = new Map(readiness.map((row) => [row.kitId, row]));
  const ready = kits.filter((kit) => isReadyToBuild(byKit.get(kit.id)));

  if (ready.length === 0) {
    return (
      <div className={cardStyles.itemList}>
        <p className={styles.quiet}>
          Nothing in the stash has a complete paint list yet. Upload a manual and extract its paints
          from a <Link href="/kits">kit&apos;s page</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className={cardStyles.itemList}>
      {ready.slice(0, MAX_ROWS).map((kit) => {
        const counts = byKit.get(kit.id);
        const total = counts ? counts.ownedCount + counts.missingCount : 0;
        return (
          <Link href={`/kits/${kit.id}`} className={`${cardStyles.itemRow} ${styles.rowLink}`} key={kit.id}>
            <KitThumb src={kit.imageUrl} alt="" />
            <span className={cardStyles.itemBody}>
              <span className={cardStyles.itemTitle}>{kit.name ?? "Untitled kit"}</span>
              <span className={styles.ready}>All {total} paints ready</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
