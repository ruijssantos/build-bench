"use client";

import { lazy } from "react";

import { DialogTrigger } from "@/components/bench/DialogTrigger";
import { PencilIcon } from "@/components/icons";
import type { KitRow } from "@/db/repositories/kits";
import ui from "@/styles/ui.module.css";

const EditPurchaseDialog = lazy(() => import("./EditPurchaseDialog").then((m) => ({ default: m.EditPurchaseDialog })));

export function EditPurchaseTrigger({ kit }: { kit: KitRow }) {
  return (
    <DialogTrigger
      dialog={EditPurchaseDialog}
      dialogProps={{ kit }}
      className={ui.iconBtn}
      title="Edit purchase & dates"
      aria-label="Edit purchase & dates"
    >
      <PencilIcon size={16} />
    </DialogTrigger>
  );
}
