import { Suspense } from "react";
import { preconnect } from "react-dom";

import { BenchError } from "@/components/bench/BenchError";
import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { KitsSkeleton } from "@/components/wishlist/KitsSkeleton";
import { KitSearch } from "@/components/wishlist/KitSearch";
import styles from "@/components/wishlist/Wishlist.module.css";
import { StashSection } from "@/components/kits/StashSection";
import { blobStoreOrigin } from "@/lib/box-art";

export const metadata = { title: "Stash" };

/**
 * The stash — docs/PLAN.md §6 Phase 4a.
 *
 * Mirrors `wishlist/page.tsx`'s shape: not async, nothing awaited at the top
 * level, the database-backed region behind its own <Suspense> inside its own
 * <BenchError>. One module, not two — the Stash has no "Other items"
 * equivalent, so this skips Wishlist's section-title tier (docs/PLAN.md
 * §4.1: that tier is reserved for a screen built from more than one
 * top-level module) and reads like `/inventory`'s single-module shape
 * instead: search, filter pills, grid, stacked directly under the header.
 *
 * Unlike the Wishlist, this screen has a `searchParams`-driven filter — the
 * status pills. Reading it any higher than inside `StashSection`'s own
 * `<Suspense>` child would make the whole page dynamic (see that file's own
 * comment, and `login/page.tsx` for the pattern this follows).
 */
export default function KitsPage(props: PageProps<"/kits">) {
  const blobOrigin = blobStoreOrigin();
  if (blobOrigin) preconnect(blobOrigin);

  return (
    <>
      <PhoneHeader title="Stash" />
      <DesktopHeader title="Stash" />

      <div className={styles.scrollArea}>
        <div className={styles.grid}>
          <KitSearch saveStatus="stash" homeHref="/kits" />
          <BenchError label="Stash">
            <Suspense fallback={<KitsSkeleton />}>
              <StashSection searchParams={props.searchParams} />
            </Suspense>
          </BenchError>
        </div>
      </div>
    </>
  );
}
