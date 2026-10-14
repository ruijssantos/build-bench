"use client";

import { lazy } from "react";

import { DialogTrigger } from "@/components/bench/DialogTrigger";
import { CameraIcon } from "@/components/icons";
import type { KitRow } from "@/db/repositories/kits";
import ui from "@/styles/ui.module.css";

import styles from "./Kits.module.css";

const ManualKitDialog = lazy(() => import("./ManualKitDialog").then((m) => ({ default: m.ManualKitDialog })));

/**
 * "Add a photo", on the art of a kit that hasn't got one — on every screen
 * that shows a saved kit, so the affordance is the same in the Stash grid,
 * the Wishlist grid and the detail page's hero.
 *
 * Only when the art is missing. A kit that *has* a picture is changed through
 * the Edit dialog, which now carries the photo field for add and edit alike:
 * a permanent camera badge sitting on top of every thumbnail was clutter on
 * the majority of cards, and it split "change this kit's picture" away from
 * the one dialog that edits everything else about the kit.
 *
 * It opens that same `ManualKitDialog` rather than a second art-only dialog —
 * one code path for one job, and it retired the separate `ArtEditDialog` (and
 * the `updateKitArt` action behind it) entirely.
 */
export function ArtEditButton({ kit }: { kit: KitRow }) {
  if (kit.imageUrl) return null;

  return (
    <DialogTrigger
      dialog={ManualKitDialog}
      dialogProps={{ kit }}
      className={`${ui.iconBtn} ${ui.iconBtnScrim} ${styles.artEditButton}`}
      title="Add a photo"
      aria-label={`Add a photo for ${kit.name ?? "this kit"}`}
    >
      <CameraIcon size={16} />
    </DialogTrigger>
  );
}
