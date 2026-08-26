import { WishlistIcon } from "@/components/icons";
import styles from "@/components/inventory/Inventory.module.css";

/** The true empty state for saved kits — matched to Paints' `EmptyShelf`:
 * same card, same icon-title-description shape, this screen's own icon in
 * place of `PaintsIcon`. */
export function EmptyKits() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateCard}>
        <WishlistIcon size={28} className={styles.emptyStateIcon} />
        <p className={styles.emptyStateTitle}>Nothing saved yet</p>
        <p className={styles.emptyStateDescription}>Search above, or add a kit by hand.</p>
      </div>
    </div>
  );
}
