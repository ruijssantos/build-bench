import { WishlistIcon } from "@/components/icons";
import page from "@/styles/page.module.css";

/** The true empty state for the Other items list — matched to Paints'
 * `EmptyShelf`. */
export function EmptyOtherItems() {
  return (
    <div className={page.emptyState}>
      <div className={page.emptyStateCard}>
        <WishlistIcon size={28} className={page.emptyStateIcon} />
        <p className={page.emptyStateTitle}>Nothing on the list yet</p>
        <p className={page.emptyStateDescription}>Use Add to put a tool or supply on the list.</p>
      </div>
    </div>
  );
}
