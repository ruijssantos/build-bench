"use client";

import { lazy, Suspense, useState } from "react";

import { PencilIcon } from "@/components/icons";

import type { EditableItem } from "./EditItemDialog";
import styles from "./Inventory.module.css";

const EditItemDialog = lazy(() =>
  import("./EditItemDialog").then((m) => ({ default: m.EditItemDialog })),
);

/**
 * One per row, and each one ships an open/closed boolean and a button — the
 * dialog is a shared chunk fetched on the first pencil anyone presses.
 * `"use client"` on the smallest thing that owns state, per
 * docs/PERFORMANCE.md §4: the row around it stays a Server Component.
 */
export function EditItemTrigger({ item }: { item: EditableItem }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.iconButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Edit ${item.paintCode}`}
        title={`Edit ${item.paintCode}`}
        onClick={() => setOpen(true)}
      >
        <PencilIcon size={16} />
      </button>

      {open ? (
        <Suspense fallback={null}>
          <EditItemDialog item={item} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
