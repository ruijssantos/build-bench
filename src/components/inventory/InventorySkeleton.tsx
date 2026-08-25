import styles from "./Inventory.module.css";

/**
 * The Suspense fallback for /inventory.
 *
 * One neutral block, not several section-shaped ones. The real result is one
 * of two unrelated shapes: a populated shelf (chips, filter pills, a table)
 * or a genuinely empty one (a single centered card) — and which one is
 * coming isn't knowable before the query resolves, so a fallback that commits
 * to the populated shape collapses jarringly on an empty shelf.
 */
export function InventorySkeleton() {
  return <div className={`${styles.skeletonBlock} ${styles.skeletonGeneric}`} />;
}
