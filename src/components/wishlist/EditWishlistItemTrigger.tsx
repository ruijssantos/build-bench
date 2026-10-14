"use client";

import { lazy, Suspense, useState } from "react";

import { PencilIcon } from "@/components/icons";
import type { WishlistItemRow } from "@/db/repositories/wishlist-items";
import ui from "@/styles/ui.module.css";

const EditWishlistItemDialog = lazy(() =>
  import("./EditWishlistItemDialog").then((m) => ({ default: m.EditWishlistItemDialog })),
);

/** An "Other items" row's Edit action — same chunk-on-click rule as the Add
 * trigger, and the same three fields, given the row to pre-fill. */
export function EditWishlistItemTrigger({ item }: { item: WishlistItemRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={ui.iconBtn}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Edit ${item.title}`}
        aria-label={`Edit ${item.title}`}
        onClick={() => setOpen(true)}
      >
        <PencilIcon size={16} />
      </button>
      {open ? (
        <Suspense fallback={null}>
          <EditWishlistItemDialog item={item} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
