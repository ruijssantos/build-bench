"use client";

import { useState, useTransition } from "react";

import { advanceKitStatus, regressKitStatus } from "@/app/(bench)/kits/actions";
import formStyles from "@/components/inventory/InventoryForm.module.css";
import styles from "@/components/wishlist/Wishlist.module.css";
import { nextStashStatus, previousStashStatus, statusLabel, type StashStatus } from "@/domain/kit";

/**
 * The stepper's primary action ("Start building" / "Mark built") and its
 * quiet "move back" escape hatch — one hop at a time, matching
 * `updateKitStatus(id, from, to)`'s own shape. Never reaches `wishlist`:
 * that direction is Phase 3's one-directional "mark bought", not undone
 * here (`previousStashStatus` stops at `stash`).
 */
export function StatusActions({ id, status }: { id: number; status: StashStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = nextStashStatus(status);
  const prev = previousStashStatus(status);

  /** Both actions return a reason when their `and(id, status)` predicate
   * misses — a stale tab acting on a kit that has since moved. Surfaced
   * rather than discarded, or the button just spins and nothing happens. */
  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      setError(null);
      try {
        const result = await action();
        if (!result.ok) setError(result.error);
      } catch {
        setError("Couldn't update that — try again.");
      }
    });
  }

  return (
    <>
      <div className={styles.statusActions}>
        {next ? (
          <button
            type="button"
            className={formStyles.primaryButton}
            disabled={pending}
            onClick={() => run(() => advanceKitStatus(id, status))}
          >
            {pending ? "Updating…" : next === "building" ? "Start building" : "Mark built"}
          </button>
        ) : null}
        {prev ? (
          <button
            type="button"
            className={formStyles.ghostButton}
            disabled={pending}
            onClick={() => run(() => regressKitStatus(id, status))}
          >
            Move back to {statusLabel(prev)}
          </button>
        ) : null}
      </div>
      {error ? <div className={styles.cardError}>{error}</div> : null}
    </>
  );
}
