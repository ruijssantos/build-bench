import { ExternalLinkIcon, SearchIcon } from "@/components/icons";
import { KitCardBody } from "@/components/kits/KitCardBody";
import styles from "@/components/kits/Kits.module.css";
import type { KitRow } from "@/db/repositories/kits";
import { spotmodelSearchUrl } from "@/domain/kit-references";
import ui from "@/styles/ui.module.css";

/**
 * Identity + art + Scalemates link — docs/PLAN.md §6 Phase 4a. Reuses
 * `KitCardBody` wholesale rather than a bespoke hero layout: the shape
 * (art, brand, name, number, chips) is identical to a grid card's, just the
 * first thing on the page instead of one tile among many, and it comes with
 * the "change photo" affordance and the status chip for free. The
 * Scalemates page and a Spotmodel search ride in its `extra` slot: the kit's
 * own reference page and the shop the owner buys its parts from. Build
 * videos and photos of the real thing are the References panel's.
 */
export function IdentityPanel({ kit }: { kit: KitRow }) {
  const spotmodel = spotmodelSearchUrl(kit);
  return (
    <div className={styles.card}>
      <KitCardBody
        imageUrl={kit.imageUrl}
        brand={kit.brand}
        name={kit.name}
        kitNumber={kit.kitNumber}
        scale={kit.scale}
        category={kit.category}
        status={kit.status}
        kit={kit}
        priority
        extra={
          <div className={styles.kitLinks}>
            {kit.scalematesUrl ? (
              <a className={`${ui.btn} ${ui.btnSm}`} href={kit.scalematesUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon size={14} /> Scalemates
              </a>
            ) : null}
            {spotmodel ? (
              <a className={`${ui.btn} ${ui.btnSm}`} href={spotmodel} target="_blank" rel="noopener noreferrer">
                <SearchIcon size={14} /> Spotmodel
              </a>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
