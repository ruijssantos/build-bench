import { PaintsIcon } from "@/components/icons";
import page from "@/styles/page.module.css";


/**
 * The true empty state — no rows in `inventory_item` at all.
 *
 * The app's empty-state card language: icon, title, one line of description,
 * centered. Says only what a user needs to hear (use Add) — nothing about
 * how the shelf gets seeded, which is an implementation detail, not a
 * product message.
 */
export function EmptyShelf() {
  return (
    <div className={page.emptyState}>
      <div className={page.emptyStateCard}>
        <PaintsIcon size={28} className={page.emptyStateIcon} />
        <p className={page.emptyStateTitle}>Your shelf is empty</p>
        <p className={page.emptyStateDescription}>
          Use Add to put your first paint on the shelf.
        </p>
      </div>
    </div>
  );
}
