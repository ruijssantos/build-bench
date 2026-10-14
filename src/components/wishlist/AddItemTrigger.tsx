"use client";

import { lazy } from "react";

import { DialogTrigger } from "@/components/bench/DialogTrigger";
import { PlusIcon } from "@/components/icons";
import ui from "@/styles/ui.module.css";

const ItemDialog = lazy(() => import("./ItemDialog").then((m) => ({ default: m.ItemDialog })));

/** The "Other items" Add button — the same dialog as a row's Edit, empty. */
export function AddItemTrigger() {
  return (
    <DialogTrigger dialog={ItemDialog} dialogProps={{}} className={`${ui.btn} ${ui.btnSm} ${ui.btnPrimary}`}>
      <PlusIcon size={14} />
      <span>Add</span>
    </DialogTrigger>
  );
}
