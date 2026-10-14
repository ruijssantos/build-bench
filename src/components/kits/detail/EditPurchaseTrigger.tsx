"use client";

import { lazy, Suspense, useState } from "react";

import { PencilIcon } from "@/components/icons";
import type { KitRow } from "@/db/repositories/kits";
import ui from "@/styles/ui.module.css";

const EditPurchaseDialog = lazy(() => import("./EditPurchaseDialog").then((m) => ({ default: m.EditPurchaseDialog })));

export function EditPurchaseTrigger({ kit }: { kit: KitRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={ui.iconBtn}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Edit purchase & dates"
        aria-label="Edit purchase & dates"
        onClick={() => setOpen(true)}
      >
        <PencilIcon size={16} />
      </button>
      {open ? (
        <Suspense fallback={null}>
          <EditPurchaseDialog kit={kit} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
