import styles from "@/components/wishlist/Wishlist.module.css";

/** The outer <Suspense> fallback, shaped from the same `.card`/`.cardBody`
 * classnames the real panels use (docs/PERFORMANCE.md §11 point 3) — not
 * pixel-exact (the real page's height depends on how many manuals and paint
 * rows a kit has, which isn't knowable before the query resolves), but close
 * enough that the two-column desktop / stacked-phone shape doesn't jump. */
export function KitDetailSkeleton() {
  return (
    <div className={styles.scrollArea} aria-hidden="true">
      <div className={styles.detailGrid}>
        <div className={styles.railCol}>
          <div className={styles.card}>
            <div className={`${styles.cardArt} ${styles.skeletonSwatch}`} />
            <div className={styles.cardBody}>
              <span className={`${styles.cardName} ${styles.skeletonLine}`} style={{ width: "70%" }}>
                Kit name
              </span>
              <span className={`${styles.cardNumber} ${styles.skeletonLine}`} style={{ width: 60 }}>
                No.
              </span>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardBody}>
              <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 56 }}>
                Status
              </span>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardBody}>
              <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 120 }}>
                Purchase &amp; dates
              </span>
            </div>
          </div>
        </div>
        <div className={styles.mainCol}>
          <div className={styles.card}>
            <div className={styles.cardBody}>
              <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 90 }}>
                Manuals
              </span>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardBody}>
              <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 70 }}>
                Paints
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
