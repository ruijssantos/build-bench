"use client";

import { useState } from "react";

import { updateKitPurchaseAction } from "@/app/(bench)/kits/actions";
import { Modal } from "@/components/bench/Modal";
import formStyles from "@/components/bench/Form.module.css";
import { PurchaseFields, purchaseValuesOf } from "@/components/kits/PurchaseFields";
import type { KitRow } from "@/db/repositories/kits";
import ui from "@/styles/ui.module.css";

export function EditPurchaseDialog({ kit, onClose }: { kit: KitRow; onClose: () => void }) {
  const [purchase, setPurchase] = useState(() => purchaseValuesOf(kit));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateKitPurchaseAction({ id: kit.id, ...purchase });
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
        <PurchaseFields values={purchase} onChange={setPurchase} disabled={saving} idPrefix="purchase" />

        {error ? <div className={formStyles.error}>{error}</div> : null}

        <div className={formStyles.actions}>
          <div className={formStyles.spacer} />
          <button type="button" className={ui.btn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
