"use client";

import { useState } from "react";

import { addInventoryItem } from "@/app/(bench)/inventory/actions";
import { Modal } from "@/components/bench/Modal";
import type { PaintHit } from "@/components/thinner/paint-search-index";

import { ItemFields, type ItemFieldsValue } from "./ItemFields";
import { PaintPicker } from "./PaintPicker";
import styles from "./InventoryForm.module.css";

/**
 * Add a paint to the shelf. Its own chunk, fetched on the first click of the
 * Add button — the picker, the fields and the catalogue index behind them are
 * none of them things a first paint should wait for.
 */

const EMPTY: ItemFieldsValue = {
  form: "bottle",
  state: null,
  quantity: "1",
  notes: "",
};

export function AddPaintDialog({ onClose }: { onClose: () => void }) {
  const [paint, setPaint] = useState<PaintHit | null>(null);
  const [fields, setFields] = useState<ItemFieldsValue>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** A TS-/AS- code is a rattle can, not a bottle: pre-select the form that
   * matches rather than making the obvious correction a second tap. */
  function pick(hit: PaintHit | null) {
    setPaint(hit);
    setError(null);
    if (hit && (hit.code.startsWith("TS-") || hit.code.startsWith("AS-") || hit.code.startsWith("PS-"))) {
      setFields((current) => ({ ...current, form: "spray_can" }));
    }
  }

  async function save() {
    if (!paint) {
      setError("Pick a paint first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await addInventoryItem({
        code: paint.code,
        form: fields.form,
        state: fields.state,
        quantity: Number(fields.quantity),
        notes: fields.notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add to the shelf" onClose={onClose}>
      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="inventory-paint-picker">
            Paint
          </label>
          <PaintPicker value={paint} onPick={pick} />
        </div>

        <ItemFields value={fields} onChange={setFields} disabled={saving} />

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.actions}>
          <div className={styles.spacer} />
          <button type="button" className={styles.ghostButton} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={styles.primaryButton} onClick={save} disabled={saving}>
            {saving ? "Adding…" : "Add paint"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
