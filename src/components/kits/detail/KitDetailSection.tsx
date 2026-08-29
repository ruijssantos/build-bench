import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BenchError } from "@/components/bench/BenchError";
import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { EditKitTrigger } from "@/components/wishlist/EditKitTrigger";
import styles from "@/components/wishlist/Wishlist.module.css";
import { getKitById } from "@/db/repositories/kits";
import { isStashStatus } from "@/domain/kit";

import { DetailsPanel } from "./DetailsPanel";
import { IdentityPanel } from "./IdentityPanel";
import { ManualsPanel } from "./ManualsPanel";
import { ManualsSkeleton } from "./ManualsSkeleton";
import { PaintsPanel } from "./PaintsPanel";
import { PaintsSkeleton } from "./PaintsSkeleton";
import { StatusPanel } from "./StatusPanel";

/**
 * `/kits/[id]` — docs/PLAN.md §6 Phase 4a, the app's first detail route.
 * The one query every other panel on this page needs (the kit row itself)
 * sits here; Manuals and Paints need queries of their own, so each gets its
 * own nested <Suspense>+<BenchError> rather than waiting on this one
 * (docs/PERFORMANCE.md §5) — a slow paint-requirements query never holds up
 * the identity, status or purchase panels.
 *
 * A wishlist-status kit reads back fine from `getKitById` (it's the same
 * table) but isn't shown here — the Wishlist screen, not this one, owns
 * that status, so it 404s the same as a missing id.
 */
export async function KitDetailSection({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const kit = await getKitById(id);
  if (!kit || !isStashStatus(kit.status)) notFound();

  const title = kit.name ?? "Kit";

  return (
    <>
      <PhoneHeader title={title} trailing={<EditKitTrigger kit={kit} />} />
      <DesktopHeader title={title} trailing={<EditKitTrigger kit={kit} />} />

      <div className={styles.scrollArea}>
        <div className={styles.detailGrid}>
          <div className={styles.railCol}>
            <IdentityPanel kit={kit} />
            <StatusPanel id={kit.id} status={kit.status} />
            <DetailsPanel kit={kit} />
          </div>
          <div className={styles.mainCol}>
            <BenchError label="Manuals">
              <Suspense fallback={<ManualsSkeleton />}>
                <ManualsPanel kitId={kit.id} />
              </Suspense>
            </BenchError>
            <BenchError label="Paints">
              <Suspense fallback={<PaintsSkeleton />}>
                <PaintsPanel kitId={kit.id} />
              </Suspense>
            </BenchError>
          </div>
        </div>
      </div>
    </>
  );
}
