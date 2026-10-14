import styles from "@/components/wishlist/Wishlist.module.css";
import ui from "@/styles/ui.module.css";

export function ManualsSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.cardBody}>
        <span className={`${ui.moduleTitle} ${styles.skeletonLine}`} style={{ width: 90 }} />
        <div className={`${styles.manualRow} ${styles.skeletonSwatch}`} style={{ height: 64, border: "none" }} />
      </div>
    </div>
  );
}
