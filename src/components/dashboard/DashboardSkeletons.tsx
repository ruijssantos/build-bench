import cardStyles from "@/components/wishlist/Wishlist.module.css";

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
          <span className={`${cardStyles.moduleTitle} ${cardStyles.skeletonLine}`} style={{ width: 76 }}>
            Label
          </span>
          <span className={styles.statRow}>
            <span className={`${styles.statValue} ${cardStyles.skeletonLine}`} style={{ width: 40 }}>
              0
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function BenchSkeleton() {
  return (
    <div className={cardStyles.cardGrid} aria-hidden="true">
      <div className={cardStyles.card}>
        <div className={`${cardStyles.cardArt} ${cardStyles.skeletonSwatch}`} />
        <div className={cardStyles.cardBody}>
          <span className={`${cardStyles.cardBrand} ${cardStyles.skeletonLine}`} style={{ width: 64 }}>
            Brand
          </span>
          <span className={`${cardStyles.cardName} ${cardStyles.skeletonLine}`} style={{ width: "80%" }}>
            Name
          </span>
          <span className={`${cardStyles.cardNumber} ${cardStyles.skeletonLine}`} style={{ width: 48 }}>
            No.
          </span>
        </div>
      </div>
    </div>
  );
}

export function RowsSkeleton() {
  return (
    <div className={cardStyles.itemList} aria-hidden="true">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div className={cardStyles.itemRow} key={i}>
          <span className={`${styles.thumb} ${cardStyles.skeletonSwatch}`} />
          <span className={cardStyles.itemBody}>
            <span className={`${cardStyles.itemTitle} ${cardStyles.skeletonLine}`} style={{ width: "70%" }}>
              Name
            </span>
            <span className={`${cardStyles.itemNotes} ${cardStyles.skeletonLine}`} style={{ width: "45%" }}>
              Meta
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
