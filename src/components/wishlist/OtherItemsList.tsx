import { listWishlistItems } from "@/db/repositories/wishlist-items";

import { EmptyOtherItems } from "./EmptyOtherItems";
import { OtherItemRow } from "./OtherItemRow";
import styles from "./Wishlist.module.css";

/** The "Other items" list, behind its own boundary — independent from the
 * Kits module, so a slow or failed kit search never holds this up. */
export async function OtherItemsList() {
  const items = await listWishlistItems();

  if (items.length === 0) {
    return <EmptyOtherItems />;
  }

  return (
    <div className={styles.itemList}>
      {items.map((item) => (
        <OtherItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}
