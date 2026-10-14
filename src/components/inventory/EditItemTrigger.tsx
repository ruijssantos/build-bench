"use client";

import { lazy } from "react";

import { DialogTrigger } from "@/components/bench/DialogTrigger";
import { PencilIcon } from "@/components/icons";
import ui from "@/styles/ui.module.css";

import type { EditableItem } from "./EditItemDialog";

const EditItemDialog = lazy(() =>
  import("./EditItemDialog").then((m) => ({ default: m.EditItemDialog })),
);

/**
 * One per row. The dialog is a shared chunk fetched on the first pencil
 * anyone presses. `"use client"` on the smallest thing that owns state, per
 * docs/PERFORMANCE.md §4: the row around it stays a Server Component.
 */
export function EditItemTrigger({ item }: { item: EditableItem }) {
  return (
    <DialogTrigger
      dialog={EditItemDialog}
      dialogProps={{ item }}
      className={ui.iconBtn}
      aria-label={`Edit ${item.paintCode}`}
      title={`Edit ${item.paintCode}`}
    >
      <PencilIcon size={16} />
    </DialogTrigger>
  );
}
