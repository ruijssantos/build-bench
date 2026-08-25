import { listWishlistItems } from "@/db/repositories/wishlist-items";

import { OtherItemRow } from "./OtherItemRow";
import styles from "./Wishlist.module.css";

/** The "Other items" list, behind its own boundary — independent from the
 * Kits module, so a slow or failed kit search never holds this up. */
export async function OtherItemsList() {
  const items = await listWishlistItems();

  if (items.length === 0) {
    return <div className={styles.emptyModule}>Nothing on the list yet — add a tool or supply above.</div>;
  }

  return (
    <div className={styles.itemList}>
      {items.map((item) => (
        <OtherItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}
