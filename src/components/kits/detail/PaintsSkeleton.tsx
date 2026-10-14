import styles from "@/components/wishlist/Wishlist.module.css";
import ui from "@/styles/ui.module.css";

export function PaintsSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.cardBody}>
        <span className={`${ui.moduleTitle} ${styles.skeletonLine}`} style={{ width: 70 }} />
        <div className={`${styles.chip} ${styles.skeletonLine}`} style={{ width: "100%", height: 60 }} />
      </div>
    </div>
  );
}
