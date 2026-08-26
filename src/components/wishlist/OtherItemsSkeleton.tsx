import styles from "./Wishlist.module.css";

/** The <Suspense> fallback for the "Other items" list. */
export function OtherItemsSkeleton() {
  return <div className={`${styles.skeletonBlock} ${styles.skeletonItems}`} />;
}
