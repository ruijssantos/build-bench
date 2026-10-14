import { ExternalLinkIcon, SearchIcon } from "@/components/icons";
import { KitCardBody } from "@/components/kits/KitCardBody";
import styles from "@/components/kits/Kits.module.css";
import { StatusBar } from "@/components/kits/StatusBar";
import type { KitRow } from "@/db/repositories/kits";
import type { KitStatus } from "@/domain/kit";
import { spotmodelSearchUrl } from "@/domain/kit-references";
import ui from "@/styles/ui.module.css";

import { StatusActions } from "./StatusActions";

/**
 * Identity + art + Scalemates link — docs/PLAN.md §6 Phase 4a. Reuses
 * `KitCardBody` wholesale rather than a bespoke hero layout: the shape
 * (art, brand, name, number, chips) is identical to a grid card's, just the
 * first thing on the page instead of one tile among many, and it comes with
 * the "change photo" affordance for free. Its `extra` slot carries the
 * Scalemates page and a Spotmodel search — the kit's own reference page and
 * the shop the owner buys its parts from — and, under them, the status.
 * Build videos and photos of the real thing are the References panel's.
 *
 * The status was a module of its own and is part of this card now: it's a
 * fact about the kit like its scale, and a separate card for one bar and two
 * buttons cost a title and a gap for nothing. `StatusBar` (shared with the
 * dashboard's bench card) over the one-hop actions — the only place status
 * changes in place, so where the bar's fill and drain are actually seen.
 * With the bar right there, the card's status chip would say the same thing
 * twice, so this card passes no `status` and the chip doesn't render.
 *
 * Four steps while the kit is still on the wishlist, three once it's bought:
 * buying is one-directional (§3.3), so on a stashed kit a Wishlist step would
 * only ever be a finished box nobody can return to.
 */
/** `status` separately from `kit`: the page has already checked it's a real
 * status (`isKitStatus`), and the row's own column is a plain string. */
export function IdentityPanel({ kit, status }: { kit: KitRow; status: KitStatus }) {
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
        kit={kit}
        priority
        extra={
          <>
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
            <div className={styles.kitStatus}>
              <StatusBar status={status} size="large" />
              <StatusActions id={kit.id} status={status} />
            </div>
          </>
        }
      />
    </div>
  );
}
