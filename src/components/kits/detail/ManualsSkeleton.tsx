import styles from "@/components/kits/Kits.module.css";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

export function ManualsSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.cardBody}>
        <span className={`${ui.moduleTitle} ${page.skeletonLine}`} style={{ width: 90 }} />
        <div className={`${styles.manualRow} ${page.skeletonSwatch}`} style={{ height: 64, border: "none" }} />
      </div>
    </div>
  );
}
