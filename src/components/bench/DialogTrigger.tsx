"use client";

import {
  Suspense,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";

import { ModalExit } from "./modal-exit";

/** Longer than any exit animation in Modal.module.css. A backstop only: if
 * `animationend` never arrives — the tab hidden mid-close, say — the dialog
 * still goes. */
const EXIT_BACKSTOP_MS = 600;

/**
 * A button that opens a dialog, and the open/closed state between them — the
 * scaffold every Add, Edit and "add a photo" trigger in the app shares.
 *
 * Pass the dialog as a `lazy()` component declared at the caller's module
 * scope: that keeps each dialog in a chunk of its own, fetched on the first
 * click rather than shipped with the screen (docs/PERFORMANCE.md §4). It has
 * to be declared there, not here, because a `lazy()` made during render is a
 * new component every render and would remount the dialog each time.
 *
 * The click never reaches anything behind the button. On a kit card the
 * whole card is a stretched link, and without this a click on the camera
 * badge navigated to the detail page instead of opening the dialog.
 *
 * Closing keeps the dialog mounted until its exit animation has played — see
 * `ModalExit` for why that takes a third state.
 */
export function DialogTrigger<P extends object>({
  dialog: Dialog,
  dialogProps,
  children,
  ...button
}: {
  dialog: ComponentType<P & { onClose: () => void }>;
  dialogProps: P;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "children">) {
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = setTimeout(() => setPhase("closed"), EXIT_BACKSTOP_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={phase === "open"}
        {...button}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPhase("open");
        }}
      >
        {children}
      </button>
      {phase !== "closed" ? (
        <ModalExit value={{ closing: phase === "closing", exited: () => setPhase("closed") }}>
          <Suspense fallback={null}>
            <Dialog {...dialogProps} onClose={() => setPhase((p) => (p === "open" ? "closing" : p))} />
          </Suspense>
        </ModalExit>
      ) : null}
    </>
  );
}
