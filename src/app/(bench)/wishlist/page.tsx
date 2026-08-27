import { Suspense } from "react";

import { BenchError } from "@/components/bench/BenchError";
import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { AddItemTrigger } from "@/components/wishlist/AddItemTrigger";
import { KitSearch } from "@/components/wishlist/KitSearch";
import { KitsSkeleton } from "@/components/wishlist/KitsSkeleton";
import { OtherItemsList } from "@/components/wishlist/OtherItemsList";
import { OtherItemsSkeleton } from "@/components/wishlist/OtherItemsSkeleton";
import { SavedKitsGrid } from "@/components/wishlist/SavedKitsGrid";
import styles from "@/components/wishlist/Wishlist.module.css";

export const metadata = { title: "Wishlist" };

/**
 * The wishlist — docs/PLAN.md §6 Phase 3.
 *
 * Two independent modules on one screen: Kits (search → candidates → save,
 * with manual entry always available) and Other items (a free-text list for
 * tools and supplies). Not async, nothing awaited at the top level — the
 * search card and both Add triggers need no database at all, so only the
 * two saved lists sit behind their own <Suspense> boundary, each with its
 * own error boundary so a slow kit search never holds up the other items
 * list or vice versa.
 */
export default function WishlistPage() {
  return (
    <>
      <PhoneHeader title="Wishlist" />
      <DesktopHeader title="Wishlist" />

      <div className={styles.scrollArea}>
        <div className={styles.grid}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Kits</h2>
            </div>
            <KitSearch />
            <BenchError label="Saved kits">
              <Suspense fallback={<KitsSkeleton />}>
                <SavedKitsGrid />
              </Suspense>
            </BenchError>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Other items</h2>
              <AddItemTrigger />
            </div>
            <BenchError label="Other items">
              <Suspense fallback={<OtherItemsSkeleton />}>
                <OtherItemsList />
              </Suspense>
            </BenchError>
          </section>
        </div>
      </div>
    </>
  );
}
