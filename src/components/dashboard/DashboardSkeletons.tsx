import cardStyles from "@/components/kits/Kits.module.css";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

import styles from "./Dashboard.module.css";

/**
 * The <Suspense> fallbacks, each shaped like the module it stands in for so
 * nothing jumps when the real thing lands (docs/PERFORMANCE.md §11 point 3).
 *
 * The row counts below are fixed, documented reservations rather than
 * guesses at the real numbers — which aren't knowable before the query
 * resolves. Same reasoning as `KitsSkeleton`'s own bound.
 */

const SKELETON_ROWS = 3;

export function StatsSkeleton() {
  return (
    <div className={styles.stats} aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div className={styles.stat} key={i}>
          <span className={`${ui.moduleTitle} ${page.skeletonLine}`} style={{ width: 76 }} />
          <span className={styles.statRow}>
            <span className={`${styles.statValue} ${page.skeletonLine}`} style={{ width: 40 }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Shaped like the real hero — `.benchCard`'s own art sizing applies here
 * too, so the reserved block is the width and height the card will be rather
 * than a stacked card that collapses sideways when the query lands. */
export function BenchSkeleton() {
  return (
    <div className={styles.benchList} aria-hidden="true">
      <div className={`${cardStyles.card} ${styles.benchCard}`}>
        <div className={`${cardStyles.cardArt} ${page.skeletonSwatch}`} />
        <div className={cardStyles.cardBody}>
          <span className={`${cardStyles.cardBrand} ${page.skeletonLine}`} style={{ width: 64 }} />
          <span className={`${cardStyles.cardName} ${page.skeletonLine}`} style={{ width: "60%" }} />
          <span className={`${cardStyles.cardNumber} ${page.skeletonLine}`} style={{ width: 48 }} />
        </div>
      </div>
    </div>
  );
}

export function RowsSkeleton() {
  return (
    <div className={page.itemList} aria-hidden="true">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div className={page.itemRow} key={i}>
          <span className={`${styles.thumb} ${page.skeletonSwatch}`} />
          <span className={page.itemBody}>
            <span className={`${page.itemTitle} ${page.skeletonLine}`} style={{ width: "70%" }} />
            <span className={`${page.itemNotes} ${page.skeletonLine}`} style={{ width: "45%" }} />
          </span>
        </div>
      ))}
    </div>
  );
}
