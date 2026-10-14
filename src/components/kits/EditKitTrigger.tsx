"use client";

import { lazy } from "react";

import { DialogTrigger } from "@/components/bench/DialogTrigger";
import { PencilIcon } from "@/components/icons";
import type { KitRow } from "@/db/repositories/kits";
import ui from "@/styles/ui.module.css";

const ManualKitDialog = lazy(() => import("./ManualKitDialog").then((m) => ({ default: m.ManualKitDialog })));

/** A saved kit's Edit action — the add-by-hand dialog, given the row to
 * pre-fill.
 *
 * `variant` picks the visual weight: `"icon"` (default) for a card's compact
 * action row, among other icons; `"button"` for the detail page's header,
 * where Edit sits beside the bordered Remove and needs to read as the same
 * kind of action, not a stray icon. */
export function EditKitTrigger({ kit, variant = "icon" }: { kit: KitRow; variant?: "icon" | "button" }) {
  const title = kit.name ?? "kit";

  return (
    <DialogTrigger
      dialog={ManualKitDialog}
      dialogProps={{ kit }}
      className={variant === "button" ? ui.btn : ui.iconBtn}
      aria-label={`Edit ${title}`}
      title={`Edit ${title}`}
    >
      <PencilIcon size={16} />
      {variant === "button" ? "Edit" : null}
    </DialogTrigger>
  );
}
