"use client";

import { lazy, Suspense, useState } from "react";

import { PencilIcon } from "@/components/icons";
import formStyles from "@/components/inventory/InventoryForm.module.css";
import type { KitRow } from "@/db/repositories/kits";

import styles from "./Wishlist.module.css";

const ManualKitDialog = lazy(() => import("./ManualKitDialog").then((m) => ({ default: m.ManualKitDialog })));

/** A saved kit's Edit action — same chunk-on-click rule as the Add trigger,
 * and the same dialog, given the row to pre-fill instead of empty fields.
 *
 * `variant` picks the visual weight: `"icon"` (default) is the borderless
 * icon used in a card's compact action row, where space is tight and it
 * reads fine among other icons; `"button"` is the bordered `.editButton`
 * shape (same family as `DeleteKitButton`'s `.deleteButton`), for the
 * detail page's header where Edit sits directly beside a bordered Delete
 * and needs to read as the same kind of action, not a stray icon. */
export function EditKitTrigger({ kit, variant = "icon" }: { kit: KitRow; variant?: "icon" | "button" }) {
  const [open, setOpen] = useState(false);
  const title = kit.name ?? "kit";

  return (
    <>
      <button
        type="button"
        className={
          variant === "button" ? `${formStyles.deleteButton} ${formStyles.editButtonHover}` : styles.iconButton
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Edit ${title}`}
        title={`Edit ${title}`}
        onClick={() => setOpen(true)}
      >
        <PencilIcon size={15} />
        {variant === "button" ? "Edit" : null}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <ManualKitDialog kit={kit} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
