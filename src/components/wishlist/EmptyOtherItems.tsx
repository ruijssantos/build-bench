import { WishlistIcon } from "@/components/icons";
import styles from "@/components/inventory/Inventory.module.css";

/** The true empty state for the Other items list — matched to Paints'
 * `EmptyShelf`. */
export function EmptyOtherItems() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateCard}>
        <WishlistIcon size={28} className={styles.emptyStateIcon} />
        <p className={styles.emptyStateTitle}>Nothing on the list yet</p>
        <p className={styles.emptyStateDescription}>Use Add to put a tool or supply on the list.</p>
      </div>
    </div>
  );
}
