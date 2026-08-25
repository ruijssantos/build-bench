"use client";

import { useState } from "react";

import { editInventoryItem, removeInventoryItem } from "@/app/(bench)/inventory/actions";
import { Modal } from "@/components/bench/Modal";
import { TrashIcon } from "@/components/icons";
import type { InventoryForm, InventoryState } from "@/domain/inventory";

import { ItemFields, type ItemFieldsValue } from "./ItemFields";
import styles from "./InventoryForm.module.css";

export interface EditableItem {
  id: number;
  paintCode: string;
  paintName: string | null;
  paintHex: string | null;
  form: InventoryForm;
  state: InventoryState | null;
  quantity: number;
  notes: string;
}

/** Edit one shelf entry. Same chunk-on-click rule as the Add dialog. */
export function EditItemDialog({ item, onClose }: { item: EditableItem; onClose: () => void }) {
  const [fields, setFields] = useState<ItemFieldsValue>({
    form: item.form,
    state: item.state,
    quantity: String(item.quantity),
    notes: item.notes,
  });
  const [saving, setSaving] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await editInventoryItem({
        id: item.id,
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

  /** Two taps, not a confirm() — the second press is the confirmation, and it
   * stays inside the dialog rather than throwing a browser modal on top of it. */
  async function remove() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await removeInventoryItem(item.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } catch {
      setError("Couldn't remove that — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`${item.paintCode} ${item.paintName ?? ""}`.trim()} onClose={onClose}>
      <div className={styles.form}>
        <div className={styles.field}>
          <span className={styles.label}>Paint</span>
          <div className={styles.picked}>
            <span
              className={styles.pickedSwatch}
              style={{ background: item.paintHex ?? "#c7c9d1" }}
            />
            <span className={styles.pickedCode}>{item.paintCode}</span>
            <span className={styles.pickedName}>{item.paintName}</span>
          </div>
          <span className={styles.hint}>
            The paint a shelf entry is for doesn&apos;t change — remove it and add the other one.
          </span>
        </div>

        <ItemFields value={fields} onChange={setFields} disabled={saving} />

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.deleteButton} ${armed ? styles.deleteArmed : ""}`}
            onClick={remove}
            disabled={saving}
          >
            <TrashIcon size={15} />
            {armed ? "Tap again to remove" : "Remove"}
          </button>
          <div className={styles.spacer} />
          <button type="button" className={styles.ghostButton} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={styles.primaryButton} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
