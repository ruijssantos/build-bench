import styles from "@/components/wishlist/Wishlist.module.css";
import { listKitManuals } from "@/db/repositories/kit-manuals";

import { ManualsList } from "./ManualsList";

/** The database-owned half of the Manuals panel — one boundary
 * (docs/PERFORMANCE.md §5), independent of the Paints panel below it so a
 * slow paints query never holds up the manuals list or vice versa. */
export async function ManualsPanel({ kitId }: { kitId: number }) {
  const manuals = await listKitManuals(kitId);

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <ManualsList kitId={kitId} manuals={manuals} />
      </div>
    </div>
  );
}
