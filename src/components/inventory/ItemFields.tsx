"use client";

import {
  INVENTORY_FORMS,
  INVENTORY_STATES,
  formLabelTitleCase,
  stateLabel,
  type InventoryForm,
  type InventoryState,
} from "@/domain/inventory";

import styles from "./InventoryForm.module.css";

/**
 * The fields Add and Edit have in common — decanted-vs-stock, bottle state,
 * how many.
 *
 * Deliberately not here: a picker for `decanted_from`. The column exists and
 * keeps the lineage of a jar back to its can, but §6 doesn't say what the UI
 * does with it and the design reference doesn't draw it, so choosing
 * "decanted jar" as the form is as far as this goes for now. Also not here,
 * on request: `location` — the owner doesn't track shelf position, so the
 * column and the field were dropped rather than left unused.
 */

export interface ItemFieldsValue {
  form: InventoryForm;
  state: InventoryState | null;
  quantity: string;
  notes: string;
}

export function ItemFields({
  value,
  onChange,
  disabled,
}: {
  value: ItemFieldsValue;
  onChange: (next: ItemFieldsValue) => void;
  disabled: boolean;
}) {
  function set<K extends keyof ItemFieldsValue>(key: K, next: ItemFieldsValue[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>Form</span>
        <div className={styles.segmented} role="group" aria-label="Form">
          {INVENTORY_FORMS.map((form) => (
            <button
              key={form}
              type="button"
              disabled={disabled}
              aria-pressed={value.form === form}
              className={`${styles.segment} ${value.form === form ? styles.segmentActive : ""}`}
              onClick={() => set("form", form)}
            >
              {formLabelTitleCase(form)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Bottle state</span>
        <div className={styles.segmented} role="group" aria-label="Bottle state">
          <button
            type="button"
            disabled={disabled}
            aria-pressed={value.state === null}
            className={`${styles.segment} ${value.state === null ? styles.segmentActive : ""}`}
            onClick={() => set("state", null)}
          >
            {stateLabel(null)}
          </button>
          {INVENTORY_STATES.map((state) => (
            <button
              key={state}
              type="button"
              disabled={disabled}
              aria-pressed={value.state === state}
              className={`${styles.segment} ${value.state === state ? styles.segmentActive : ""}`}
              onClick={() => set("state", state)}
            >
              {stateLabel(state)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="inventory-quantity">
          How many
        </label>
        <input
          id="inventory-quantity"
          className={styles.input}
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          disabled={disabled}
          value={value.quantity}
          onChange={(e) => set("quantity", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="inventory-notes">
          Notes
        </label>
        <input
          id="inventory-notes"
          className={styles.input}
          type="text"
          placeholder="Optional"
          disabled={disabled}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
    </>
  );
}
