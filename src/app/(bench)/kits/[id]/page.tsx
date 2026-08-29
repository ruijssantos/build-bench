import Link from "next/link";
import { Suspense } from "react";
import { preconnect } from "react-dom";

import { BenchError } from "@/components/bench/BenchError";
import { ChevronLeftIcon } from "@/components/icons";
import { KitDetailSection } from "@/components/kits/detail/KitDetailSection";
import { KitDetailSkeleton } from "@/components/kits/detail/KitDetailSkeleton";
import styles from "@/components/wishlist/Wishlist.module.css";
import { blobStoreOrigin } from "@/lib/box-art";

/**
 * `/kits/[id]` — docs/PLAN.md §6 Phase 4a, the app's first detail route.
 * Not `async`, and `params` isn't awaited at this level — it's passed down
 * into `KitDetailSection`'s own `<Suspense>` child, so this frame still
 * prerenders (docs/PERFORMANCE.md §1; the dynamic-routes guide's own
 * example is exactly this shape). Deliberately not added to
 * `ROUTES_THAT_MUST_PRERENDER` in `scripts/check-perf-budget.ts` — a
 * dynamic segment emits no matching `.html` for that check to find.
 *
 * The breadcrumb needs no kit data, so it stays outside the Suspense
 * boundary — the one piece of this screen genuinely free to render before
 * the id resolves.
 */
export default function KitDetailPage(props: PageProps<"/kits/[id]">) {
  const blobOrigin = blobStoreOrigin();
  if (blobOrigin) preconnect(blobOrigin);

  return (
    <>
      <Link href="/kits" className={styles.crumb}>
        <ChevronLeftIcon size={18} /> Stash
      </Link>

      <BenchError label="Kit">
        <Suspense fallback={<KitDetailSkeleton />}>
          <KitDetailSection params={props.params} />
        </Suspense>
      </BenchError>
    </>
  );
}
