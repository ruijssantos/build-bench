import { Suspense } from "react";
import { preconnect } from "react-dom";

import { BenchError } from "@/components/bench/BenchError";
import { blobStoreOrigin } from "@/lib/box-art";

import { KitDetailSection, type KitListHref } from "./KitDetailSection";
import { KitDetailSkeleton } from "./KitDetailSkeleton";

/**
 * A kit's detail page, served at the URL of the list the kit is on —
 * `/wishlist/[id]` for a wishlist kit, `/kits/[id]` for one in the stash — so
 * the nav highlights the list you came from and the URL says where the kit
 * is. Both route files render this, naming their own list.
 *
 * Not `async`, and `params` isn't awaited at this level — it's passed down
 * into `KitDetailSection`'s own `<Suspense>` child, so this frame still
 * prerenders (docs/PERFORMANCE.md §1). Not in `ROUTES_THAT_MUST_PRERENDER`
 * (`scripts/check-perf-budget.ts`): a dynamic segment emits no matching
 * `.html` for that check to find.
 */
export function KitDetailPage({ params, listHref }: { params: Promise<{ id: string }>; listHref: KitListHref }) {
  const blobOrigin = blobStoreOrigin();
  if (blobOrigin) preconnect(blobOrigin);

  return (
    <BenchError label="Kit">
      <Suspense fallback={<KitDetailSkeleton />}>
        <KitDetailSection params={params} listHref={listHref} />
      </Suspense>
    </BenchError>
  );
}
