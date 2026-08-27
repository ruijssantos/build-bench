"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { SearchIcon, XIcon } from "@/components/icons";

import styles from "./SearchField.module.css";

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type" | "value" | "onChange"> {
  id: string;
  /** Visually hidden — every search box on the bench is icon-led with a
   * placeholder doing the visible labelling, but a screen reader still needs
   * a real name. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Renders the inline × button when the field has a value. Kept optional
   * rather than always-on: Thinner clears back to type-ahead's empty state,
   * Wishlist's clear also resets its results — same control, different
   * caller-owned behaviour behind it. */
  onClear?: () => void;
}

/**
 * The bench's one search box shell — icon, input, optional clear button —
 * shared by Thinner's type-ahead and the Wishlist's kit search rather than
 * kept as two copies of the same CSS. Presentational only: neither
 * debouncing, dropdown, nor submit behaviour lives here, so each caller
 * wires its own logic around an identical-looking box.
 *
 * Forwards its ref to the `<input>` — Thinner needs it for keyboard focus
 * management after a result is picked or the field is cleared.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { id, label, value, onChange, onClear, ...inputProps },
  ref,
) {
  return (
    <div className={styles.box}>
      <SearchIcon size={19} className={styles.icon} />
      <label htmlFor={id} className={styles.srOnly}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={styles.input}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
      {onClear && value ? (
        <button
          type="button"
          className={styles.clearButton}
          aria-label="Clear search"
          onMouseDown={(e) => {
            // preventDefault, not onClick: keeps focus on the input rather
            // than blurring to the button first, so a caller's own
            // focus-dependent UI (Thinner's dropdown) doesn't close early.
            e.preventDefault();
            onClear();
          }}
        >
          <XIcon size={16} />
        </button>
      ) : null}
    </div>
  );
});
