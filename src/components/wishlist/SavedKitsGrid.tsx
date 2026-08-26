import { listKitsByStatus } from "@/db/repositories/kits";

import { SavedKitCard } from "./SavedKitCard";
import styles from "./Wishlist.module.css";

/**
 * The saved half of the Kits module — everything the database owns here,
 * behind one boundary (docs/PERFORMANCE.md §5). `listKitsByStatus` is
 * request-time then cached, so a second visit costs nothing.
 */
export async function SavedKitsGrid() {
  const kits = await listKitsByStatus("wishlist");

  if (kits.length === 0) {
    return <div className={styles.emptyModule}>Nothing saved yet — search above, or add a kit by hand.</div>;
  }

  return (
    <div className={styles.cardGrid}>
      {kits.map((kit) => (
        <SavedKitCard key={kit.id} kit={kit} />
      ))}
    </div>
  );
}
