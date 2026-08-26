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
        <span className={styles.moduleTitle}>Saved kits</span>
        <span className={styles.moduleMeta}>{kits.length} on the wishlist</span>
      </div>
      <div className={styles.cardGrid}>
        {kits.map((kit) => (
          <SavedKitCard key={kit.id} kit={kit} />
        ))}
      </div>
    </>
  );
}
