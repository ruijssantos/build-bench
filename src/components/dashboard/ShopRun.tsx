import Link from "next/link";

import { AlertIcon, LowBottleIcon } from "@/components/icons";
import cardStyles from "@/components/wishlist/Wishlist.module.css";
import { listInventory } from "@/db/repositories/inventory";
import { getStashReadiness } from "@/db/repositories/kit-paint-requirements";
import { listShopRunPaints } from "@/db/repositories/shop-run";
import { buildShopRun } from "@/domain/dashboard";

import styles from "./Dashboard.module.css";

/**
 * "Next shop run" — docs/PLAN.md §6 Phase 6.
 *
 * Two errands in one list: paints a kit you're building or about to build
 * calls for and you don't own, then bottles you do own that are marked low.
 * The divider between them is doing real work — the first half blocks a
 * build, the second is housekeeping — and merging them into one ranked list
 * would bury the distinction.
 *
 * This is the persisted `shopping_list_item` table's replacement (§7, §8):
 * derived on read, so there is no list to tick stale and nothing to keep in
 * sync with the shelf.
 */
export async function ShopRun() {
  const [missing, shelf, readiness] = await Promise.all([
    listShopRunPaints(),
    listInventory(),
    getStashReadiness(),
  ]);
  const entries = buildShopRun(missing, shelf);
  const unresolved = readiness.reduce((sum, row) => sum + row.unresolvedCount, 0);

  if (entries.length === 0) {
    return (
      <>
        <div className={cardStyles.itemList}>
          <p className={styles.quiet}>
            Nothing to buy — every paint your kits call for is on the shelf, and nothing is running
            low.
          </p>
        </div>
        <UnresolvedNote count={unresolved} />
      </>
    );
  }

  const firstLowIndex = entries.findIndex((entry) => entry.reason === "low");

  return (
    <>
      <div className={cardStyles.itemList}>
        {entries.map((entry, index) => (
          <div key={`${entry.reason}-${entry.code}`}>
            {index === firstLowIndex && index > 0 ? <div className={styles.split} /> : null}
            <div className={cardStyles.itemRow}>
              <span className={cardStyles.paintDot} style={{ background: entry.hex }} />
              <span className={cardStyles.itemBody}>
                <span className={cardStyles.itemTitle}>{entry.code}</span>
                <span className={cardStyles.itemNotes}>
                  {entry.name}
                  {entry.reason === "missing" && entry.kitCount
                    ? ` · ${entry.kitCount} ${entry.kitCount === 1 ? "kit" : "kits"}`
                    : " · on the shelf"}
                </span>
              </span>
              {entry.reason === "missing" ? (
                <span className={styles.tag}>Missing</span>
              ) : (
                <span className={styles.tag}>
                  <LowBottleIcon size={12} />
                  Low
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <UnresolvedNote count={unresolved} />
    </>
  );
}

/**
 * Foreign paint codes a manual called out that no cross-brand row resolved.
 * Phase 5's lookup exists now, so this is a prompt to go use it rather than a
 * dead end — and it sits under the shop list because it is the same errand:
 * things standing between a kit and its paint.
 */
function UnresolvedNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link href="/kits" className={styles.note}>
      <AlertIcon size={16} />
      {count} paint {count === 1 ? "callout needs" : "callouts need"} a cross-brand lookup
    </Link>
  );
}
