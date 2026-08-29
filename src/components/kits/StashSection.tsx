import { SavedKitsGrid } from "@/components/wishlist/SavedKitsGrid";
import { countKitsByStatus } from "@/db/repositories/kits";
import { STASH_STATUSES, statusLabel } from "@/domain/kit";

import { EmptyStash, EmptyStashFiltered } from "./EmptyStash";
import { readKitsStatusFilter, type KitsSearchParams } from "./kits-params";
import { StashKitCard } from "./StashKitCard";
import { StatusFilterPills } from "./StatusFilterPills";

/**
 * Everything the database owns on `/kits`, behind one `<Suspense>`
 * boundary (docs/PERFORMANCE.md §5) — the status filter lives in
 * `searchParams`, which has to be read down here inside the Suspense child
 * rather than at the top of the page, the way `login/page.tsx`'s own
 * `searchParams` read works: reading it any higher would make the whole
 * page dynamic and cost it its prerendered shell.
 *
 * `countKitsByStatus` doesn't depend on which pill is active — it always
 * counts every stash status, since the filter row shows every pill's count
 * regardless — so it runs alongside resolving `searchParams` rather than
 * after it.
 */
export async function StashSection({ searchParams }: { searchParams: Promise<KitsSearchParams> }) {
  const [resolvedParams, counts] = await Promise.all([searchParams, countKitsByStatus([...STASH_STATUSES])]);
  const filter = readKitsStatusFilter(resolvedParams);
  const statuses = filter ? [filter] : [...STASH_STATUSES];

  return (
    <>
      <StatusFilterPills active={filter} counts={counts} />
      <SavedKitsGrid
        statuses={statuses}
        moduleLabel={filter ? statusLabel(filter) : "All kits"}
        withReadiness
        emptyState={filter ? <EmptyStashFiltered label={statusLabel(filter)} /> : <EmptyStash />}
        renderCard={(kit, priority, readiness) => (
          <StashKitCard key={kit.id} kit={kit} priority={priority} readiness={readiness} />
        )}
      />
    </>
  );
}
