import styles from "./Inventory.module.css";

/**
 * What the CDN hands over while the shelf streams in.
 *
 * Built from the real components' own grid areas and card heights, so the
 * layout the prerendered shell paints is the layout the data lands into —
 * docs/PERFORMANCE.md §11.3.
 */
export function InventorySkeleton() {
  return (
    <>
      <div className={styles.shelfArea}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonShelf}`} />
      </div>
      <div className={styles.filtersArea}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonFilters}`} />
      </div>
      <div className={styles.lowArea}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonLow}`} />
      </div>
      <div className={styles.recentArea}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonRecent}`} />
      </div>
      <div className={styles.tableArea}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonTable}`} />
      </div>
    </>
  );
}
