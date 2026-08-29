"use client";

import { useState } from "react";

import { updateKitPurchaseAction } from "@/app/(bench)/kits/actions";
import { Modal } from "@/components/bench/Modal";
import formStyles from "@/components/inventory/InventoryForm.module.css";
import type { KitRow } from "@/db/repositories/kits";

export function EditPurchaseDialog({ kit, onClose }: { kit: KitRow; onClose: () => void }) {
  const [purchasedFrom, setPurchasedFrom] = useState(kit.purchasedFrom ?? "");
  const [purchasedAt, setPurchasedAt] = useState(kit.purchasedAt ?? "");
  const [startedAt, setStartedAt] = useState(kit.startedAt ?? "");
  const [completedAt, setCompletedAt] = useState(kit.completedAt ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateKitPurchaseAction({ id: kit.id, purchasedFrom, purchasedAt, startedAt, completedAt });
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
    <Modal title="Purchase & dates" onClose={onClose}>
      <div className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="purchase-from">
            Purchased from
          </label>
          <input
            id="purchase-from"
            className={formStyles.input}
            type="text"
            placeholder="Shop name"
            value={purchasedFrom}
            onChange={(e) => setPurchasedFrom(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="purchase-at">
            Purchased on
          </label>
          <input
            id="purchase-at"
            className={formStyles.input}
            type="date"
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="started-at">
            Started
          </label>
          <input
            id="started-at"
            className={formStyles.input}
            type="date"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="completed-at">
            Completed
          </label>
          <input
            id="completed-at"
            className={formStyles.input}
            type="date"
            value={completedAt}
            onChange={(e) => setCompletedAt(e.target.value)}
            disabled={saving}
          />
        </div>

        <span className={formStyles.hint}>
          Started/Completed are stamped automatically when you advance the status above — this is where to correct or
          backfill them.
        </span>

        {error ? <div className={formStyles.error}>{error}</div> : null}

        <div className={formStyles.actions}>
          <div className={formStyles.spacer} />
          <button type="button" className={formStyles.ghostButton} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={formStyles.primaryButton} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
