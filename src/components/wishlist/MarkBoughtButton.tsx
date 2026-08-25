"use client";

import { useTransition } from "react";

import { markKitBought } from "@/app/(bench)/wishlist/actions";
import { CheckIcon } from "@/components/icons";

import styles from "./Wishlist.module.css";

/**
 * The saved kit card's "Bought" tick — `status: wishlist → stash` (§3.3).
 * Calls the Server Action directly rather than through a `<form>`: it takes
 * an id, not a `FormData`, and this is the one control on the card that
 * needs a pending state (the row leaves the grid once it lands).
 */
export function MarkBoughtButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={styles.boughtButton}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markKitBought(id);
        })
      }
    >
      <CheckIcon size={13} />
      <span>{pending ? "Marking…" : "Bought"}</span>
    </button>
  );
}
