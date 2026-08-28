import styles from "./Wishlist.module.css";

/** How many card-shaped placeholders to reserve — a fixed, documented bound,
 * not a guess at the real count (which isn't knowable before the query
 * resolves; see the comment above `.skeletonSwatch` in Wishlist.module.css
 * and docs/PERFORMANCE.md, Wishlist section). */
const SKELETON_KIT_COUNT = 2;

/**
 * The <Suspense> fallback for the saved-kits grid, shaped like the real
 * thing: the same `.subHead`/`.cardGrid`/`.card` classes `SavedKitsGrid` and
 * `SavedKitCard` use, so each reserved card is exactly the height its real
 * counterpart will be — not one undifferentiated block (docs/PERFORMANCE.md
 * §11 point 3).
 */
export function KitsSkeleton() {
  return (
    <>
      <div className={styles.subHead} aria-hidden="true">
        <span className={`${styles.moduleTitle} ${styles.skeletonLine}`}>Saved kits</span>
      </div>
      <div className={styles.cardGrid} aria-hidden="true">
        {Array.from({ length: SKELETON_KIT_COUNT }, (_, i) => (
          <div className={styles.card} key={i}>
            <div className={`${styles.cardArt} ${styles.skeletonSwatch}`} />
            <div className={styles.cardBody}>
              <span className={`${styles.cardBrand} ${styles.skeletonLine}`} style={{ width: 64 }}>
                Brand
              </span>
              <span className={`${styles.cardName} ${styles.skeletonLine}`} style={{ width: "80%" }}>
                Name
              </span>
              <span className={`${styles.cardNumber} ${styles.skeletonLine}`} style={{ width: 48 }}>
                No.
              </span>
              <div className={styles.cardChips}>
                <span className={`${styles.chip} ${styles.skeletonLine}`} style={{ width: 56 }}>
                  Scale
                </span>
              </div>
            </div>
            <div className={styles.savedCardActions}>
              <span className={`${styles.boughtButton} ${styles.skeletonLine}`} style={{ width: 96 }}>
                Bought
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
