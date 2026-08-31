"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { removeKitAndReturn } from "@/app/(bench)/kits/actions";
import { TrashIcon } from "@/components/icons";
import formStyles from "@/components/inventory/InventoryForm.module.css";

/**
 * Remove, beside Edit in the detail header. Two taps, arming on the first —
 * the same pattern (and the same `.deleteButton`/`.deleteArmed` classes) the
 * shelf's own Edit dialog uses, because this deletes a kit's manuals and
 * paint requirements along with it and there is no undo.
 *
 * Arming isn't sticky: a click anywhere else on the page disarms it back to
 * "Remove", so walking away from a half-confirmed delete doesn't leave a
 * live "one more click deletes this" trap for whatever gets clicked next.
 *
 * The action redirects to `/kits` on success, so there is no success state to
 * render here — only a failure one, for a kit already gone from another tab.
 */
export function DeleteKitButton({ id, name }: { id: number; name: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!armed) return;
    function handlePointerDown(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) setArmed(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [armed]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${formStyles.deleteButton} ${armed ? formStyles.deleteArmed : ""}`}
        disabled={pending}
        aria-label={armed ? `Confirm removing ${name}` : `Remove ${name}`}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          startTransition(async () => {
            setError(null);
            try {
              // On success this doesn't return a value — the action's
              // `redirect()` is applied by the router, not thrown back here.
              // A returned result therefore always means the delete didn't
              // happen, and a rejection means the call itself failed.
              const result = await removeKitAndReturn(id);
              if (result && !result.ok) {
                setError(result.error);
                setArmed(false);
              }
            } catch {
              setError("Couldn't remove that kit — try again.");
              setArmed(false);
            }
          });
        }}
      >
        <TrashIcon size={15} />
        {pending ? "Removing…" : armed ? "Tap again to remove" : "Remove"}
      </button>
      {error ? <span className={formStyles.error}>{error}</span> : null}
    </>
  );
}
