"use client";

import { Suspense, useState, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from "react";

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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        {...button}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <Dialog {...dialogProps} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
