"use client";

import { useState } from "react";

import { updateWishlistItem } from "@/app/(bench)/wishlist/actions";
import { Modal } from "@/components/bench/Modal";
import formStyles from "@/components/inventory/InventoryForm.module.css";
import type { WishlistItemRow } from "@/db/repositories/wishlist-items";

/** Edit an "Other items" row — the same three fields `AddItemDialog` takes,
 * pre-filled. Its own chunk, loaded on click. */
export function EditWishlistItemDialog({ item, onClose }: { item: WishlistItemRow; onClose: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
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
      const result = await updateWishlistItem({ id: item.id, title, url, notes });
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
    <Modal title="Edit item" onClose={onClose}>
      <div className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="edit-wishlist-item-title">
            Title
          </label>
          <input
            id="edit-wishlist-item-title"
            className={formStyles.input}
            type="text"
            placeholder="Flush cutters, masking tape…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="edit-wishlist-item-url">
            Link
          </label>
          <input
            id="edit-wishlist-item-url"
            className={formStyles.input}
            type="url"
            placeholder="Optional"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="edit-wishlist-item-notes">
            Notes
          </label>
          <input
            id="edit-wishlist-item-notes"
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
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
