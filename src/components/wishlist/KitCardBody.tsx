import { categoryLabel } from "@/domain/kit";

import { KitArt } from "./KitArt";
import styles from "./Wishlist.module.css";

/**
 * Box art, brand + name + number, scale and category — the card shape both
 * a search candidate and a saved kit share (docs/PLAN.md §6 Phase 3). Pure
 * presentation, no server or client boundary of its own; `KitArt` is the
 * one piece of it that needs to be a client island.
 */
export function KitCardBody({
  imageUrl,
  brand,
  name,
  kitNumber,
  scale,
  category,
}: {
  imageUrl: string | null;
  brand: string | null;
  name: string | null;
  kitNumber: string | null;
  scale: string | null;
  category: string | null;
}) {
  return (
    <>
      <KitArt src={imageUrl} alt="" />
      <div className={styles.cardBody}>
        {brand ? <span className={styles.cardBrand}>{brand}</span> : null}
        <span className={styles.cardName}>{name ?? "Untitled kit"}</span>
        {kitNumber ? <span className={styles.cardNumber}>{kitNumber}</span> : null}
        {scale || category ? (
          <div className={styles.cardChips}>
            {scale ? <span className={styles.chip}>{scale}</span> : null}
            {category ? <span className={styles.chip}>{categoryLabel(category)}</span> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
