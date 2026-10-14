"use client";

import { lazy } from "react";

import { DialogTrigger } from "@/components/bench/DialogTrigger";
import { PencilIcon } from "@/components/icons";
import type { WishlistItemRow } from "@/db/repositories/wishlist-items";
import ui from "@/styles/ui.module.css";

const ItemDialog = lazy(() => import("./ItemDialog").then((m) => ({ default: m.ItemDialog })));

/** An "Other items" row's Edit action — the Add dialog, given the row to
 * pre-fill. */
export function EditWishlistItemTrigger({ item }: { item: WishlistItemRow }) {
  return (
    <DialogTrigger
      dialog={ItemDialog}
      dialogProps={{ item }}
      className={ui.iconBtn}
      title={`Edit ${item.title}`}
      aria-label={`Edit ${item.title}`}
    >
      <PencilIcon size={16} />
    </DialogTrigger>
  );
}
