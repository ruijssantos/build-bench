"use client";

import { useState } from "react";

import { addManualKit } from "@/app/(bench)/wishlist/actions";
import { Modal } from "@/components/bench/Modal";
import formStyles from "@/components/inventory/InventoryForm.module.css";
import { categoryLabel, KIT_CATEGORIES } from "@/domain/kit";

/**
 * Manual kit entry — always available (docs/PLAN.md §6 Phase 3), for
 * anything the search can't place. Its own chunk, fetched only once "Add a
 * kit by hand" is actually clicked.
 */
export function ManualKitDialog({ onClose }: { onClose: () => void }) {
  const [brand, setBrand] = useState("");
  const [kitNumber, setKitNumber] = useState("");
  const [name, setName] = useState("");
  const [scale, setScale] = useState("1:24");
  const [category, setCategory] = useState<string>("cars");
  const [scalematesUrl, setScalematesUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!brand.trim() || !name.trim()) {
      setError("Give it at least a brand and a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await addManualKit({ brand, kitNumber, name, scale, category, scalematesUrl, notes });
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
    <Modal title="Add a kit by hand" onClose={onClose}>
      <div className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="manual-kit-brand">
            Brand
          </label>
          <input
            id="manual-kit-brand"
            className={formStyles.input}
            type="text"
            placeholder="Tamiya"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="manual-kit-name">
            Name
          </label>
          <input
            id="manual-kit-name"
            className={formStyles.input}
            type="text"
            placeholder="Nissan Skyline GT-R (R34)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="manual-kit-number">
            Kit number
          </label>
          <input
            id="manual-kit-number"
            className={formStyles.input}
            type="text"
            placeholder="24345"
            value={kitNumber}
            onChange={(e) => setKitNumber(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="manual-kit-scale">
            Scale
          </label>
          <input
            id="manual-kit-scale"
            className={formStyles.input}
            type="text"
            placeholder="1:24"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="manual-kit-category">
            Category
          </label>
          <select
            id="manual-kit-category"
            className={formStyles.input}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={saving}
          >
            {KIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="manual-kit-scalemates">
            Scalemates link
          </label>
          <input
            id="manual-kit-scalemates"
            className={formStyles.input}
            type="url"
            placeholder="Optional"
            value={scalematesUrl}
            onChange={(e) => setScalematesUrl(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="manual-kit-notes">
            Notes
          </label>
          <input
            id="manual-kit-notes"
            className={formStyles.input}
            type="text"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>

        {error ? <div className={formStyles.error}>{error}</div> : null}

        <div className={formStyles.actions}>
          <div className={formStyles.spacer} />
          <button type="button" className={formStyles.ghostButton} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={formStyles.primaryButton} onClick={() => void save()} disabled={saving}>
            {saving ? "Adding…" : "Add kit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
