import styles from "@/components/kits/Kits.module.css";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

export function PaintsSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.cardBody}>
        <span className={`${ui.moduleTitle} ${page.skeletonLine}`} style={{ width: 70 }} />
        <div className={`${styles.chip} ${page.skeletonLine}`} style={{ width: "100%", height: 60 }} />
      </div>
    </div>
  );
}
