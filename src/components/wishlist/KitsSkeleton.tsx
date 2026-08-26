import styles from "./Wishlist.module.css";

/** The <Suspense> fallback for the saved-kits grid. One neutral block, not a
 * fake grid of cards — same reasoning as `InventorySkeleton`: whether the
 * real result is a populated grid or the empty state isn't knowable before
 * the query resolves. */
export function KitsSkeleton() {
  return <div className={`${styles.skeletonBlock} ${styles.skeletonKits}`} />;
}
