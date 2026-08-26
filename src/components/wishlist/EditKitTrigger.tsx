"use client";

import { lazy, Suspense, useState } from "react";

import { PencilIcon } from "@/components/icons";
import type { KitRow } from "@/db/repositories/kits";

import styles from "./Wishlist.module.css";

const ManualKitDialog = lazy(() => import("./ManualKitDialog").then((m) => ({ default: m.ManualKitDialog })));

/** A saved kit's Edit action — same chunk-on-click rule as the Add trigger,
 * and the same dialog, given the row to pre-fill instead of empty fields. */
export function EditKitTrigger({ kit }: { kit: KitRow }) {
  const [open, setOpen] = useState(false);
  const title = kit.name ?? "kit";

  return (
    <>
      <button
        type="button"
        className={styles.iconButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Edit ${title}`}
        title={`Edit ${title}`}
        onClick={() => setOpen(true)}
      >
        <PencilIcon size={15} />
      </button>
      {open ? (
        <Suspense fallback={null}>
          <ManualKitDialog kit={kit} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
