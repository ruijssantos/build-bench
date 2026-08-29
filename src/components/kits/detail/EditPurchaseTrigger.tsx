"use client";

import { lazy, Suspense, useState } from "react";

import { PencilIcon } from "@/components/icons";
import styles from "@/components/wishlist/Wishlist.module.css";
import type { KitRow } from "@/db/repositories/kits";

const EditPurchaseDialog = lazy(() => import("./EditPurchaseDialog").then((m) => ({ default: m.EditPurchaseDialog })));

export function EditPurchaseTrigger({ kit }: { kit: KitRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.iconButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Edit purchase & dates"
        aria-label="Edit purchase & dates"
        onClick={() => setOpen(true)}
      >
        <PencilIcon size={14} />
      </button>
      {open ? (
        <Suspense fallback={null}>
          <EditPurchaseDialog kit={kit} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
