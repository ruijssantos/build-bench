import { PaintsIcon } from "@/components/icons";
import styles from "./Kits.module.css";
import type { ReadinessCounts } from "@/domain/kit-paints";

/**
 * "Own 14 of 17 · 3 missing" — a kit card's readiness line, rendered from a
 * `ReadinessCounts` (`PaintsIcon`, the same glyph the nav rail's Paints tab uses, marking the
 * line as being about paints without spending a text label on saying so).
 *
 * Wishlist and Stash cards read it the same way: "N missing" for a gap,
 * "Ready to build" for a full shelf, owned or not.
 *
 * A complete shelf reads just "Ready to build" —
 * the count adds nothing once nothing is missing. An LP or TS covered by an
 * owned X/XF twin counts as owned (nothing to buy, nothing stopping the
 * build) and isn't called out here; the detail page's Equivalents section is
 * where the stand-ins are shown.
 */
export function ReadyLine({ readiness }: { readiness: ReadinessCounts | undefined }) {
  if (!readiness) {
    return (
      <div className={styles.readyNone}>
        <PaintsIcon size={13} className={styles.readyIcon} />
        No paint list yet
      </div>
    );
  }

  const have = readiness.ownedCount + readiness.equivalentCount;

  return (
    <div className={styles.readyLine}>
      <PaintsIcon size={13} className={styles.readyIcon} />
      {readiness.missingCount > 0 ? (
        <>
          <span className={styles.readyCount}>
            Own {have} of {have + readiness.missingCount}
          </span>
          <span className={styles.readyBuy}>
            · {readiness.missingCount} missing
          </span>
        </>
      ) : (
        <span className={styles.readyReady}>Ready to build</span>
      )}
      {readiness.unresolvedCount > 0 ? (
        <span className={styles.readyUnresolved}>+{readiness.unresolvedCount} unresolved</span>
      ) : null}
    </div>
  );
}
