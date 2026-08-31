"use client";

import { useState, useTransition } from "react";

import { advanceKitStatus } from "@/app/(bench)/kits/actions";
import { CheckIcon } from "@/components/icons";
import { nextStashStatus, type StashStatus } from "@/domain/kit";
import styles from "@/components/wishlist/Wishlist.module.css";

/**
 * The Stash card's one-tap advance — forked from the Wishlist's
 * `MarkBoughtButton` (same pending-state shape) rather than generalised: that
 * button fires a one-directional, wishlist-only transition with its own
 * label ("Stash"); this one walks the Stash's own three-step ladder and has
 * to compute which label that is on every render.
 *
 * Renders nothing once a kit is `built` — there's nowhere further forward to
 * tap to, and the detail page's status stepper is where "move back" lives.
 */
export function AdvanceStatusButton({ id, status }: { id: number; status: StashStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = nextStashStatus(status);
  if (!next) return null;

  const label = next === "building" ? "Start building" : "Mark built";

  return (
    <>
      <button
        type="button"
        className={styles.boughtButton}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              // The action returns a real reason when its `and(id, status)`
              // predicate misses — a stale tab acting on a kit that has since
              // moved. Throwing that away left the button spinning and then
              // silently doing nothing.
              const result = await advanceKitStatus(id, status);
              if (!result.ok) setError(result.error);
            } catch {
              setError("Couldn't update that — try again.");
            }
          })
        }
      >
        <CheckIcon size={13} />
        <span>{pending ? "Updating…" : label}</span>
      </button>
      {error ? <span className={styles.cardError}>{error}</span> : null}
    </>
  );
}
