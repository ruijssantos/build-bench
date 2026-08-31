import { PaintsIcon } from "@/components/icons";
import styles from "@/components/wishlist/Wishlist.module.css";
import type { ReadinessCounts } from "@/domain/kit-paints";

/**
 * "Own 14 of 17 · 3 to buy" — the Stash card's line and the detail page's
 * Paints panel summary both render this from a `ReadinessCounts`
 * (`PaintsIcon`, the same glyph the nav rail's Paints tab uses, marking the
 * line as being about paints without spending a text label on saying so).
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

  const resolved = readiness.ownedCount + readiness.missingCount;

  return (
    <div className={styles.readyLine}>
      <PaintsIcon size={13} className={styles.readyIcon} />
      {readiness.missingCount > 0 ? (
        <>
          <span className={styles.readyCount}>
            Own {readiness.ownedCount} of {resolved}
          </span>
          <span className={styles.readyBuy}>· {readiness.missingCount} to buy</span>
        </>
      ) : (
        <span className={styles.readyReady}>
          Own {resolved} of {resolved} · Ready to build
        </span>
      )}
      {readiness.unresolvedCount > 0 ? (
        <span className={styles.readyUnresolved}>+{readiness.unresolvedCount} unresolved</span>
      ) : null}
    </div>
  );
}
