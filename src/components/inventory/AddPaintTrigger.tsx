"use client";

import { lazy, Suspense, useState } from "react";

import { PlusIcon } from "@/components/icons";

import styles from "./Inventory.module.css";

const AddPaintDialog = lazy(() =>
  import("./AddPaintDialog").then((m) => ({ default: m.AddPaintDialog })),
);

/**
 * The Add button, and an open/closed boolean. Everything the dialog needs —
 * the paint index, the fields, the mutation — is behind that `lazy()`, so the
 * shelf screen paints without any of it.
 */
export function AddPaintTrigger() {
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
        <PlusIcon size={15} />
        <span>Add</span>
      </button>

      {open ? (
        <Suspense fallback={null}>
          <AddPaintDialog onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
