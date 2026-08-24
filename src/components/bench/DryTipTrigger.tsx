"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";

/**
 * The button that opens the rig's Tips & Guide, and nothing else.
 *
 * Two things keep this cheap. The dialog itself is a separate chunk, fetched
 * on the first click rather than on every page load. And `trigger`/`children`
 * arrive already rendered from a Server Component, so `DryTipContent`'s couple
 * of thousand words of guidance never enter the client bundle — this island
 * ships an open/closed boolean and the markup to toggle it.
 */
const Modal = lazy(() => import("./Modal").then((m) => ({ default: m.Modal })));

export function DryTipTrigger({
  title,
  className,
  ariaLabel,
  trigger,
  children,
}: {
  title: string;
  className?: string;
  ariaLabel?: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </button>

      {open ? (
        <Suspense fallback={null}>
          <Modal title={title} onClose={() => setOpen(false)}>
            {children}
          </Modal>
        </Suspense>
      ) : null}
    </>
  );
}
