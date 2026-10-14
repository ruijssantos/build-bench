import { Suspense } from "react";
import { preconnect } from "react-dom";

import { BenchError } from "@/components/bench/BenchError";
import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { AddItemTrigger } from "@/components/wishlist/AddItemTrigger";
import { EmptyKits } from "@/components/wishlist/EmptyKits";
import { KitSearch } from "@/components/kits/KitSearch";
import { KitsSkeleton } from "@/components/kits/KitsSkeleton";
import { OtherItemsList } from "@/components/wishlist/OtherItemsList";
import { OtherItemsSkeleton } from "@/components/wishlist/OtherItemsSkeleton";
import { SavedKitCard } from "@/components/wishlist/SavedKitCard";
import { SavedKitsGrid } from "@/components/kits/SavedKitsGrid";
import { blobStoreOrigin } from "@/lib/box-art";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

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
  // The origin resolves from an env var alone (see `blobStoreOrigin`), so
  // this stays safe to call unconditionally in the static shell — DNS + TLS
  // for the saved kits' box art can start before the grid's own query even
  // begins. docs/PERFORMANCE.md, Wishlist section.
  const blobOrigin = blobStoreOrigin();
  if (blobOrigin) preconnect(blobOrigin);

  return (
    <>
      <PhoneHeader title="Wishlist" />
      <DesktopHeader title="Wishlist" />

      <div className={page.scrollArea}>
        <div className={page.grid}>
          <section className={page.section}>
            <div className={page.sectionHead}>
              <h2 className={ui.sectionTitle}>Kits</h2>
            </div>
            <KitSearch saveStatus="wishlist" homeHref="/wishlist" />
            <BenchError label="Saved kits">
              <Suspense fallback={<KitsSkeleton />}>
                <SavedKitsGrid
                  statuses={["wishlist"]}
                  moduleLabel="Saved kits"
                  withReadiness
                  emptyState={<EmptyKits />}
                  renderCard={(kit, priority, readiness) => (
                    <SavedKitCard key={kit.id} kit={kit} priority={priority} readiness={readiness} />
                  )}
                />
              </Suspense>
            </BenchError>
          </section>

          <section className={page.section}>
            <div className={page.sectionHead}>
              <h2 className={ui.sectionTitle}>Other items</h2>
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
