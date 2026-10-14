"use client";

import { use, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import { XIcon } from "@/components/icons";
import ui from "@/styles/ui.module.css";

import { ModalExit } from "./modal-exit";
import styles from "./Modal.module.css";

/**
 * Rendered through a portal to `<body>`, not in place.
 *
 * Every trigger that opens one of these lives inside the thing it edits — a
 * kit card's action row, the art in its corner — and those rows set
 * `z-index` to sit above the card's own stretched link. A positioned element
 * with a `z-index` creates a *stacking context*, which means this overlay's
 * own `z-index: 50` stops competing with the page and starts competing only
 * with its siblings inside that row. The result: open a dialog from one card
 * and the *other* cards' buttons paint straight over the top of it, because
 * they are all pegged at the same level in the root and simply come later in
 * the DOM. No z-index on the overlay can fix that from inside; escaping to
 * `<body>` can, and does it for every caller at once.
 *
 * The `document` guard is for the server render, where there is no DOM to
 * portal into. It costs no hydration mismatch: every caller renders this only
 * once its own `open` state is true, and that state starts false and is set by
 * a click, so a Modal is never part of a server-rendered tree in the first
 * place. (A `useState` + `useEffect` "mounted" gate would do the same job and
 * is the more familiar idiom, but it buys nothing here and trips React's
 * set-state-in-effect rule.)
 */
export function Modal({
  title,
  lead,
  onClose,
  children,
}: {
  title: string;
  /** Shown before the title — a paint's colour swatch, say. The title stays
   * a string so it can name the dialog for a screen reader. */
  lead?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(lockPageScroll, []);

  const exit = use(ModalExit);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`${styles.overlay} ${exit?.closing ? styles.closing : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onAnimationEnd={(e) => {
          // Only the dialog's own exit — a spinner inside it animates too.
          if (exit?.closing && e.target === e.currentTarget) exit.exited();
        }}
      >
        <div className={styles.header}>
          {lead}
          <span className={styles.title}>{title}</span>
          <button type="button" className={ui.iconBtn} aria-label="Close" onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** How many modals are open, so closing one of two doesn't unlock the page
 * under the other. */
let openModals = 0;

/**
 * Stops the page behind the dialog scrolling, on a phone and a desk alike.
 *
 * The document is what scrolls in this app: the bench shell is only a
 * `min-height`, so it grows with its content. An overlay can't stop that by
 * itself: a swipe or wheel over the scrim scrolls whatever is beneath, and
 * one inside the dialog that runs past the end of its body chains on to the
 * page. `overflow: hidden` on the root element stops both — with the page
 * not scrollable there's nothing to chain to — and iOS Safari honours it on
 * `<html>`.
 *
 * The padding stands in for the scrollbar the lock removes, so a desktop
 * page doesn't jump sideways when a dialog opens.
 */
function lockPageScroll(): () => void {
  const root = document.documentElement;
  if (openModals++ === 0) {
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
  }
  return () => {
    if (--openModals === 0) {
      root.style.overflow = "";
      root.style.paddingRight = "";
    }
  };
}
