import { KitsIcon } from "@/components/icons";
import { statusEmptyLine, type StashStatus } from "@/domain/kit";
import page from "@/styles/page.module.css";

/** The true empty state for the stash — forked from the Wishlist's
 * `EmptyKits` (same card, same icon-title-description shape) rather than
 * generalised, since the copy has to name where an add on *this* screen
 * goes. Used only when no filter narrows the grid to nothing (see
 * `EmptyStashFiltered` for that case). */
export function EmptyStash() {
  return (
    <div className={page.emptyState}>
      <div className={page.emptyStateCard}>
        <KitsIcon size={28} className={page.emptyStateIcon} />
        <p className={page.emptyStateTitle}>Nothing in the stash yet</p>
        <p className={page.emptyStateDescription}>Search above, or add a kit by hand — it saves straight here.</p>
      </div>
    </div>
  );
}

/**
 * A status filter with nothing in it — the shelf's own family filter has the
 * same distinction (`.emptyCard`, dashed, quiet) from the true empty state
 * above: the stash isn't empty, just this slice of it.
 *
 * Takes the status, not a label: `statusLabel` is a noun for `stash` and an
 * adjective for the other two, so splicing it into one fixed sentence read as
 * "No kits are currently stash."
 */
export function EmptyStashFiltered({ status }: { status: StashStatus }) {
  return <div className={page.emptyCard}>{statusEmptyLine(status)}</div>;
}
