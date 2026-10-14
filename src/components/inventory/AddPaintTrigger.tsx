"use client";

import { lazy } from "react";

import { DialogTrigger } from "@/components/bench/DialogTrigger";
import { PlusIcon } from "@/components/icons";
import ui from "@/styles/ui.module.css";

import styles from "./Inventory.module.css";

/** Everything the dialog needs — the paint index, the fields, the mutation —
 * is behind this `lazy()`, so the shelf screen paints without any of it. */
const AddPaintDialog = lazy(() =>
  import("./AddPaintDialog").then((m) => ({ default: m.AddPaintDialog })),
);

export function AddPaintTrigger() {
  return (
    <DialogTrigger dialog={AddPaintDialog} dialogProps={{}} className={`${ui.btn} ${ui.btnPrimary} ${styles.addButton}`}>
      <PlusIcon size={16} />
      <span>Add</span>
    </DialogTrigger>
  );
}
