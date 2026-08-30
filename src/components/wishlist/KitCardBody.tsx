import type { ReactNode } from "react";

import type { KitRow } from "@/db/repositories/kits";
import { categoryLabel, statusLabel } from "@/domain/kit";

import { ArtEditButton } from "./ArtEditButton";
import { KitArt } from "./KitArt";
import styles from "./Wishlist.module.css";

/** Three distinct looks so a status is scannable down a grid — see the
 * `.chipStatus*` note in `Wishlist.module.css` for the token choices, and for
 * why those rules have to sit after `.chip` in that file. `wishlist` keeps the
 * plain chip: on the Wishlist screen every card has that status, so colouring
 * it would say nothing. */
function statusChipClass(status: string): string {
  if (status === "building") return styles.chipStatusBuilding;
  if (status === "built") return styles.chipStatusBuilt;
  if (status === "stash") return styles.chipStatusStash;
  return "";
}

/**
 * Box art, brand + name + number, scale and category — the card shape a
 * search candidate, a saved wishlist kit and a stashed kit all share
 * (docs/PLAN.md §6 Phases 3–4a). Pure presentation, no server or client
 * boundary of its own; `KitArt` and `ArtEditButton` are the pieces of it
 * that need to be client islands.
 */
export function KitCardBody({
  imageUrl,
  brand,
  name,
  kitNumber,
  scale,
  category,
  status,
  notes,
  priority,
  kit,
  extra,
}: {
  imageUrl: string | null;
  brand: string | null;
  name: string | null;
  kitNumber: string | null;
  scale: string | null;
  category: string | null;
  /** A saved kit's `status` — rendered as a coloured chip. `null`/absent for
   * a not-yet-saved search candidate, which has no status of its own yet. */
  status?: string | null;
  /** Only a hand-entered kit has these — a resolved candidate carries none.
   * Rendered here because `ManualKitDialog` collects the field, and §7
   * rules out an Edit dialog this phase: unrendered, anything typed into it
   * would be unreachable from the moment the dialog closed. */
  notes?: string | null;
  /** Set on the LCP candidate only — see `KitArt`. */
  priority?: boolean;
  /** The saved row this card is showing — when present, and only while it has
   * no art, the picture gets the "add a photo" affordance (`ArtEditButton`,
   * which needs the whole row to hand to the edit dialog). Absent for a search
   * candidate, which isn't saved yet and has nothing to point an edit at. */
  kit?: KitRow;
  /** Extra content rendered inside the card body, after the chips — the
   * Stash card's readiness line ("Own 14 of 17 · 3 to buy"). */
  extra?: ReactNode;
}) {
  return (
    <>
      {kit ? (
        <div className={styles.artWrap}>
          <KitArt src={imageUrl} alt="" priority={priority} />
          <ArtEditButton kit={kit} />
        </div>
      ) : (
        <KitArt src={imageUrl} alt="" priority={priority} />
      )}
      <div className={styles.cardBody}>
        {brand ? <span className={styles.cardBrand}>{brand}</span> : null}
        <span className={styles.cardName}>{name ?? "Untitled kit"}</span>
        {kitNumber ? <span className={styles.cardNumber}>{kitNumber}</span> : null}
        {scale || category || status ? (
          <div className={styles.cardChips}>
            {scale ? <span className={styles.chip}>{scale}</span> : null}
            {category ? <span className={styles.chip}>{categoryLabel(category)}</span> : null}
            {status ? (
              <span className={`${styles.chip} ${statusChipClass(status)}`}>{statusLabel(status)}</span>
            ) : null}
          </div>
        ) : null}
        {extra}
        {notes ? <span className={styles.cardNotes}>{notes}</span> : null}
      </div>
    </>
  );
}
