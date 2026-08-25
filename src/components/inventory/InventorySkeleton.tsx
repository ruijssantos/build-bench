import styles from "./Inventory.module.css";

/**
 * The Suspense fallback for /inventory.
 *
 * One neutral block, not five section-shaped ones. The real result is one of
 * two unrelated shapes: a populated shelf (a two-column grid of independent
 * modules) or a genuinely empty one (a single centered card) — and which one
 * is coming isn't knowable before the query resolves, so a fallback that
 * commits to the populated shape collapses jarringly on an empty shelf.
 *
 * It was wrong more often than that, too: "Running low" renders nothing at
 * all when nothing is low (the common case), so a skeleton that always shows
 * a low-list block was flashing and disappearing on most ordinary loads, not
 * just the empty one.
 */
export function InventorySkeleton() {
  return (
    <div className={styles.skeletonSingle}>
      <div className={`${styles.skeletonBlock} ${styles.skeletonGeneric}`} />
    </div>
  );
}
