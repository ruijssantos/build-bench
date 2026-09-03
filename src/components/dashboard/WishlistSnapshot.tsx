import Link from "next/link";

import cardStyles from "@/components/wishlist/Wishlist.module.css";
import { listKitsByStatuses } from "@/db/repositories/kits";
import { listWishlistItems } from "@/db/repositories/wishlist-items";

import { KitThumb } from "./KitThumb";
import styles from "./Dashboard.module.css";

/** A glance, not a list — the Wishlist screen is one tap away. */
const MAX_ROWS = 3;

/**
 * The most recently added wishlist kits, plus how many non-kit items are
 * still wanted — docs/PLAN.md §6 Phase 6.
 *
 * `listKitsByStatuses(["wishlist"])` already returns newest-first for a
 * single status (its sort collapses to `created_at desc` when every row
 * scores the same), so this takes the head of that list rather than asking
 * for a different ordering — and shares the Wishlist screen's own cache
 * entry for doing so.
 */
export async function WishlistSnapshot() {
  const [kits, items] = await Promise.all([listKitsByStatuses(["wishlist"]), listWishlistItems()]);
  const wanted = items.filter((item) => item.status === "wanted");

  if (kits.length === 0 && wanted.length === 0) {
    return (
      <div className={cardStyles.itemList}>
        <p className={styles.quiet}>
          Nothing on the <Link href="/wishlist">wishlist</Link> yet.
        </p>
      </div>
    );
  }

  return (
    <div className={cardStyles.itemList}>
      {kits.slice(0, MAX_ROWS).map((kit) => (
        <Link href="/wishlist" className={`${cardStyles.itemRow} ${styles.rowLink}`} key={kit.id}>
          <KitThumb src={kit.imageUrl} alt="" />
          <span className={cardStyles.itemBody}>
            <span className={cardStyles.itemTitle}>{kit.name ?? "Untitled kit"}</span>
            <span className={cardStyles.itemNotes}>
              {[kit.brand, kit.kitNumber].filter(Boolean).join(" · ") || "No details yet"}
            </span>
          </span>
        </Link>
      ))}
      {wanted.length > 0 ? (
        <Link href="/wishlist" className={`${cardStyles.itemRow} ${styles.rowLink}`}>
          <span className={cardStyles.itemBody}>
            <span className={cardStyles.itemNotes}>
              {wanted.length} other {wanted.length === 1 ? "item" : "items"} wanted
            </span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}
