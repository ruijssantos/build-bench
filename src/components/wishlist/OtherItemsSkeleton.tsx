import styles from "./Wishlist.module.css";

/** Same reasoning as `SKELETON_KIT_COUNT` in `KitsSkeleton` — a fixed,
 * documented bound, not the real count. */
const SKELETON_ITEM_COUNT = 3;

/**
 * The <Suspense> fallback for the "Other items" list, shaped like the real
 * thing: `.itemList`/`.itemRow` and the row's own children, so three rows
 * reserve exactly three rows' worth of height rather than one guessed block.
 */
export function OtherItemsSkeleton() {
  return (
    <div className={styles.itemList} aria-hidden="true">
      {Array.from({ length: SKELETON_ITEM_COUNT }, (_, i) => (
        <div className={styles.itemRow} key={i}>
          <span className={`${styles.itemTick} ${styles.skeletonTick}`} />
          <div className={styles.itemBody}>
            <span className={`${styles.itemTitle} ${styles.skeletonLine}`} style={{ width: i === 1 ? "40%" : "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
