import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BenchError } from "@/components/bench/BenchError";
import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { ChevronLeftIcon } from "@/components/icons";
import { EditKitTrigger } from "@/components/wishlist/EditKitTrigger";
import styles from "@/components/wishlist/Wishlist.module.css";
import { getKitById } from "@/db/repositories/kits";
import { isKitStatus } from "@/domain/kit";

import { DeleteKitButton } from "./DeleteKitButton";
import { DetailsPanel } from "./DetailsPanel";
import { IdentityPanel } from "./IdentityPanel";
import { ManualsPanel } from "./ManualsPanel";
import { ManualsSkeleton } from "./ManualsSkeleton";
import { PaintsPanel } from "./PaintsPanel";
import { PaintsSkeleton } from "./PaintsSkeleton";
import { ResearchPanel } from "./ResearchPanel";
import { ResearchSkeleton } from "./ResearchSkeleton";
import { StatusPanel } from "./StatusPanel";

/**
 * `/kits/[id]` — docs/PLAN.md §6 Phase 4a, the app's first detail route.
 * The one query every other panel on this page needs (the kit row itself)
 * sits here; Manuals, Paints and Research need queries of their own, so each
 * gets its own nested <Suspense>+<BenchError> rather than waiting on this one
 * (docs/PERFORMANCE.md §5) — a slow paint-requirements query never holds up
 * the identity, status or purchase panels.
 *
 * Research goes last of the three deliberately. Manuals and Paints are the
 * kit's own facts; Research is what strangers on the internet think of it
 * (§5.4), and it reads better as the thing you scroll down to than as
 * something competing with the paint list for the top of the column.
 *
 * Every status renders here, wishlist included — a kit is the same object
 * before and after you buy it (§3.3), and a manual, a paint check against the
 * shelf and research are all worth having before buying. What differs is
 * status-shaped: the breadcrumb leads back to the list the kit is on, the
 * stepper grows a Wishlist step while the kit is still on it, and
 * "Purchase & dates" stays hidden until it's bought.
 */
export async function KitDetailSection({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const kit = await getKitById(id);
  if (!kit || !isKitStatus(kit.status)) notFound();

  const wanted = kit.status === "wishlist";
  const title = kit.name ?? "Kit";
  const headerActions = (
    <div className={styles.headerActions}>
      <EditKitTrigger kit={kit} variant="button" />
      <DeleteKitButton id={kit.id} name={title} />
    </div>
  );

  return (
    <>
      <Link href={wanted ? "/wishlist" : "/kits"} className={styles.crumb}>
        <ChevronLeftIcon size={18} /> {wanted ? "Wishlist" : "Stash"}
      </Link>
      <PhoneHeader title={title} trailing={headerActions} stackTrailing />
      <DesktopHeader title={title} trailing={headerActions} />

      <div className={styles.scrollArea}>
        <div className={styles.detailGrid}>
          <div className={styles.railCol}>
            <IdentityPanel kit={kit} />
            <StatusPanel id={kit.id} status={kit.status} />
            {wanted ? null : <DetailsPanel kit={kit} />}
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
            <BenchError label="Research">
              <Suspense fallback={<ResearchSkeleton />}>
                <ResearchPanel kit={kit} />
              </Suspense>
            </BenchError>
          </div>
        </div>
      </div>
    </>
  );
}
