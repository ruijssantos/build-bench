"use client";

import { lazy, Suspense, useState } from "react";

import { CameraIcon } from "@/components/icons";

import styles from "./Wishlist.module.css";

const ArtEditDialog = lazy(() => import("./ArtEditDialog").then((m) => ({ default: m.ArtEditDialog })));

/**
 * The camera affordance on a kit's art — the same "change photo" control on
 * every screen that shows a saved kit (the Stash list, the Stash detail
 * hero, and the Wishlist's own cards), added consistently rather than once
 * on the detail page alone. Its own small dialog rather than routing
 * through `ManualKitDialog`'s full identity form: this changes exactly one
 * field.
 *
 * Sits as a sibling of `KitArt` inside a `position: relative` wrapper
 * (`KitCardBody`'s `.artWrap`) rather than living inside `KitArt` itself, so
 * a not-yet-saved search candidate (`KitCandidateCard`, which never passes a
 * kit id into `KitCardBody`) never renders one. The dialog itself is a lazy
 * chunk, fetched only on click (docs/PERFORMANCE.md §4) — every card on the
 * Stash and Wishlist grids carries this button, so its upload/fetch logic
 * staying out of the initial bundle is what keeps that cheap.
 */
export function ArtEditButton({ kitId, hasArt }: { kitId: number; hasArt: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.artEditButton}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={hasArt ? "Change photo" : "Add a photo"}
        aria-label={hasArt ? "Change photo" : "Add a photo"}
      >
        <CameraIcon size={15} />
      </button>
      {open ? (
        <Suspense fallback={null}>
          <ArtEditDialog kitId={kitId} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
