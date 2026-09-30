"use client";

import { useState, useTransition, type ReactNode } from "react";

import { markLowRestocked, markPaintBought } from "@/app/(bench)/inventory/actions";
import styles from "@/components/wishlist/Wishlist.module.css";

/**
 * One-click "Bought" on a Missing paint — the kit Paints panel's chips and
 * the Dashboard shop run's Missing tag. Adds one to the shelf
 * (`markPaintBought`); the server re-render then moves the paint to Owned,
 * off the shop run, and onto the Paints screen, because all three read the
 * shelf rather than a copy of it.
 *
 * `children` is what the control reads at rest (the chip's dot and code, or
 * the tag's "Missing"); hover and focus swap it for "Bought" in green. The
 * two labels share one grid cell, so the swap never changes the control's
 * width and never reflows the row of chips around it.
 *
 * `restock` is the shop run's Low entry: the paint is already on the shelf,
 * so "Bought" there clears its running-low mark (`markLowRestocked`) rather
 * than adding a row, and the entry leaves the run.
 *
 * No confirmation and no undo toast, same reasoning as `DismissUnresolved`:
 * a mistaken click is one row to remove on the Paints screen. A failure keeps
 * the paint where it is with the reason as the tooltip, rather than
 * optimistically claiming a bottle the shelf doesn't have.
 */
export function MarkBought({
  code,
  name,
  className,
  restock = false,
  children,
}: {
  code: string;
  name: string;
  className: string;
  restock?: boolean;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      className={`${className} ${styles.markBought}`}
      data-pending={pending || undefined}
      disabled={pending}
      title={
        error ??
        (restock
          ? `Mark ${code} ${name} as bought — clears running low`
          : `Mark ${code} ${name} as bought — adds it to your paints`)
      }
      aria-label={`${code}, ${name} — mark as bought`}
      onClick={() =>
        start(async () => {
          setError(null);
          const result = await (restock ? markLowRestocked(code) : markPaintBought(code));
          if (!result.ok) setError(result.error);
        })
      }
    >
      <span className={styles.markBoughtStack}>
        <span className={styles.markBoughtIdle}>{children}</span>
        <span className={styles.markBoughtAction} aria-hidden="true">
          {pending ? "Saving…" : "Bought"}
        </span>
      </span>
    </button>
  );
}
