import styles from "@/components/wishlist/Wishlist.module.css";

/** Same shape and reservation rule as `PaintsSkeleton` — a title line and one
 * block standing in for the panel's body, text-free so nothing has to be
 * hidden with `color: transparent` (see `BenchSkeleton.module.css` for why
 * that lost). */
export function ResearchSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.cardBody}>
        <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 82 }} />
        <div className={`${styles.chip} ${styles.skeletonLine}`} style={{ width: "100%", height: 60 }} />
      </div>
    </div>
  );
}
