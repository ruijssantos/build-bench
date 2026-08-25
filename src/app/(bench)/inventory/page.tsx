import { Suspense } from "react";

import { BenchError } from "@/components/bench/BenchError";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { AddPaintTrigger } from "@/components/inventory/AddPaintTrigger";
import { InventoryContent } from "@/components/inventory/InventoryContent";
import { InventorySkeleton } from "@/components/inventory/InventorySkeleton";
import styles from "@/components/inventory/Inventory.module.css";

export const metadata = { title: "Paints" };

/**
 * The shelf — docs/PLAN.md §6, Phase 2.
 *
 * Not async, and nothing awaited here. The header, the title, the Add button
 * and the grid the shelf lands in are the same whatever is on the shelf, so
 * they prerender once and a CDN serves them; the one boundary underneath is
 * the inventory itself, which is the only thing here the database owns.
 *
 * The Add button sits in the shell rather than inside that boundary on
 * purpose: adding a paint is the one thing you can do on this screen that
 * doesn't depend on what's already on it.
 */
export default function InventoryPage(props: PageProps<"/inventory">) {
  return (
    <>
      <PhoneHeader title="Paints" trailing={<AddPaintTrigger />} />

      <div className={styles.desktopHeader}>
        <div className={styles.desktopTitle}>Paints</div>
        <div className={styles.desktopHeaderSpacer} />
        <AddPaintTrigger />
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.grid}>
          <BenchError label="The shelf">
            <Suspense fallback={<InventorySkeleton />}>
              <InventoryContent searchParams={props.searchParams} />
            </Suspense>
          </BenchError>
        </div>
      </div>
    </>
  );
}
