import { PaintsIcon } from "@/components/icons";

import styles from "./Inventory.module.css";

/**
 * The true empty state — no rows in `inventory_item` at all.
 *
 * Same card language as `ComingSoon`: icon, title, one line of description,
 * centered. Says only what a user needs to hear (use Add) — nothing about
 * how the shelf gets seeded, which is an implementation detail, not a
 * product message.
 */
export function EmptyShelf() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateCard}>
        <PaintsIcon size={28} className={styles.emptyStateIcon} />
        <p className={styles.emptyStateTitle}>Your shelf is empty</p>
        <p className={styles.emptyStateDescription}>
          Use Add, above, to put your first paint on the shelf.
        </p>
      </div>
    </div>
  );
}
