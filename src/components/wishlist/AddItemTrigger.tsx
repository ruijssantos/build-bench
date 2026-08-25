"use client";

import { lazy, Suspense, useState } from "react";

import { PlusIcon } from "@/components/icons";

import styles from "./Wishlist.module.css";

const AddItemDialog = lazy(() => import("./AddItemDialog").then((m) => ({ default: m.AddItemDialog })));

/** The "Other items" Add button. Same shape as inventory's
 * `AddPaintTrigger` — the dialog is a lazy chunk, fetched on first click. */
export function AddItemTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.addButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={13} />
        <span>Add</span>
      </button>

      {open ? (
        <Suspense fallback={null}>
          <AddItemDialog onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
