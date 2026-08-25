"use client";

import { useState } from "react";

import { addWishlistItem } from "@/app/(bench)/wishlist/actions";
import { Modal } from "@/components/bench/Modal";
import formStyles from "@/components/inventory/InventoryForm.module.css";

/** Add a tool or supply to the "Other items" list — title, optional URL and
 * notes (docs/PLAN.md §6 Phase 3). Its own chunk, loaded on click. */
export function AddItemDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Give it a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await addWishlistItem({ title, url, notes });
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
    <Modal title="Add to the list" onClose={onClose}>
      <div className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="wishlist-item-title">
            Title
          </label>
          <input
            id="wishlist-item-title"
            className={formStyles.input}
            type="text"
            placeholder="Flush cutters, masking tape…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="wishlist-item-url">
            Link
          </label>
          <input
            id="wishlist-item-url"
            className={formStyles.input}
            type="url"
            placeholder="Optional"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="wishlist-item-notes">
            Notes
          </label>
          <input
            id="wishlist-item-notes"
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
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
