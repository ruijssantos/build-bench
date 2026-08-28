import { listKitsByStatus } from "@/db/repositories/kits";

import { EmptyKits } from "./EmptyKits";
import { SavedKitCard } from "./SavedKitCard";
import styles from "./Wishlist.module.css";

/**
 * The saved half of the Kits module — everything the database owns here,
 * behind one boundary (docs/PERFORMANCE.md §5). `listKitsByStatus` is
 * request-time then cached, so a second visit costs nothing.
 *
 * Sits below the search card, independent of whatever the search box is
 * doing — these persist across visits, search results don't.
 */
export async function SavedKitsGrid() {
  const kits = await listKitsByStatus("wishlist");

  if (kits.length === 0) {
    return <EmptyKits />;
  }

  return (
    <>
      <div className={styles.subHead}>
        <span className={styles.moduleTitle}>Saved kits ({kits.length})</span>
      </div>
      <div className={styles.cardGrid}>
        {kits.map((kit, index) => (
          // The first card is the wishlist's LCP element on a cold load —
          // see KitArt. Everything after it keeps the ordinary lazy path.
          <SavedKitCard key={kit.id} kit={kit} priority={index === 0} />
        ))}
      </div>
    </>
  );
}
