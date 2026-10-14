import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

import styles from "./Kits.module.css";

/** How many card-shaped placeholders to reserve — a fixed, documented bound,
 * not a guess at the real count (which isn't knowable before the query
 * resolves; see the skeleton section of `src/styles/page.module.css`
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
      <div className={page.subHead} aria-hidden="true">
        <span className={`${ui.moduleTitle} ${page.skeletonLine}`} />
      </div>
      <div className={styles.cardGrid} aria-hidden="true">
        {Array.from({ length: SKELETON_KIT_COUNT }, (_, i) => (
          <div className={styles.card} key={i}>
            <div className={`${styles.cardArt} ${page.skeletonSwatch}`} />
            <div className={styles.cardBody}>
              <span className={`${styles.cardBrand} ${page.skeletonLine}`} style={{ width: 64 }} />
              <span className={`${styles.cardName} ${page.skeletonLine}`} style={{ width: "80%" }} />
              <span className={`${styles.cardNumber} ${page.skeletonLine}`} style={{ width: 48 }} />
              <div className={styles.cardChips}>
                <span className={`${styles.chip} ${page.skeletonLine}`} style={{ width: 56 }} />
              </div>
            </div>
            <div className={styles.savedCardActions}>
              <span className={page.skeletonButton} style={{ width: 96 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
