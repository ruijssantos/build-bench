import { WishlistIcon } from "@/components/icons";
import page from "@/styles/page.module.css";

/** The true empty state for saved kits — matched to Paints' `EmptyShelf`:
 * same card, same icon-title-description shape, this screen's own icon in
 * place of `PaintsIcon`. */
export function EmptyKits() {
  return (
    <div className={page.emptyState}>
      <div className={page.emptyStateCard}>
        <WishlistIcon size={28} className={page.emptyStateIcon} />
        <p className={page.emptyStateTitle}>Nothing saved yet</p>
        <p className={page.emptyStateDescription}>Search above, or add a kit by hand.</p>
      </div>
    </div>
  );
}
