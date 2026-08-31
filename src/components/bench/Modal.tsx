"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import { XIcon } from "@/components/icons";

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
  onClose,
  children,
}: {
  title: string;
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button type="button" className={styles.closeButton} aria-label="Close" onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
