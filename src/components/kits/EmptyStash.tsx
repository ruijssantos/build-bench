import { KitsIcon } from "@/components/icons";
import styles from "@/components/inventory/Inventory.module.css";

/** The true empty state for the stash — forked from the Wishlist's
 * `EmptyKits` (same card, same icon-title-description shape) rather than
 * generalised, since the copy has to name where an add on *this* screen
 * goes. Used only when no filter narrows the grid to nothing (see
 * `EmptyStashFiltered` for that case). */
export function EmptyStash() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateCard}>
        <KitsIcon size={28} className={styles.emptyStateIcon} />
        <p className={styles.emptyStateTitle}>Nothing in the stash yet</p>
        <p className={styles.emptyStateDescription}>Search above, or add a kit by hand — it saves straight here.</p>
      </div>
    </div>
  );
}

/** A status filter with nothing in it — the shelf's own family-filter
 * has this same distinction (`.emptyCard`, dashed, quiet) from the true
 * empty state above: the stash isn't empty, just this slice of it. */
export function EmptyStashFiltered({ label }: { label: string }) {
  return <div className={styles.emptyCard}>No kits are currently {label.toLowerCase()}.</div>;
}
