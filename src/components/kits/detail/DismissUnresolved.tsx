"use client";

import { useState, useTransition } from "react";

import { dismissUnresolvedPaint } from "@/app/(bench)/kits/actions";
import styles from "@/components/wishlist/Wishlist.module.css";

/**
 * "Dismiss" on an unresolved callout.
 *
 * Extraction reads small print off scanned diagrams, and sometimes returns a
 * table cell that isn't a paint at all. Without this the only way to stop
 * being told about it is to stop reading the panel, which costs the whole
 * bucket its meaning.
 *
 * The smallest possible client boundary — the Paints panel stays a server
 * component and only this control ships JS. No confirmation step and no
 * undo, because the mistake is cheap and already reversible: re-running
 * extraction rewrites the manual's rows and every dismissal goes with them.
 * A failure keeps the row on screen with the reason attached, rather than
 * optimistically hiding something that is still there.
 */
export function DismissUnresolved({ kitId, rawLabel }: { kitId: number; rawLabel: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={`${styles.linkButton} ${styles.dismissAction}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await dismissUnresolvedPaint(kitId, rawLabel);
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Dismissing…" : "Dismiss"}
      </button>
      {error ? <span className={styles.unresolvedTag}>{error}</span> : null}
    </>
  );
}
