"use client";

import { useState } from "react";

import { addWishlistItem, updateWishlistItem } from "@/app/(bench)/wishlist/actions";
import { Modal } from "@/components/bench/Modal";
import formStyles from "@/components/bench/Form.module.css";
import type { WishlistItemRow } from "@/db/repositories/wishlist-items";
import ui from "@/styles/ui.module.css";

/** A tool or supply on the "Other items" list — title, optional URL and
 * notes (docs/PLAN.md §6 Phase 3). Adds a new row, or edits `item` when given
 * one, pre-filled; one dialog for both so the two can't drift apart. Its own
 * chunk, loaded on click. */
export function ItemDialog({ item, onClose }: { item?: WishlistItemRow; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
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
      const result = item
        ? await updateWishlistItem({ id: item.id, title, url, notes })
        : await addWishlistItem({ title, url, notes });
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
    <Modal title={item ? "Edit item" : "Add to the list"} onClose={onClose}>
      <div className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={ui.fieldLabel} htmlFor="wishlist-item-title">
            Title
          </label>
          <input
            id="wishlist-item-title"
            className={ui.input}
            type="text"
            placeholder="Flush cutters, masking tape…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={ui.fieldLabel} htmlFor="wishlist-item-url">
            Link
          </label>
          <input
            id="wishlist-item-url"
            className={ui.input}
            type="url"
            placeholder="Optional"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className={formStyles.field}>
          <label className={ui.fieldLabel} htmlFor="wishlist-item-notes">
            Notes
          </label>
          <input
            id="wishlist-item-notes"
            className={ui.input}
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
          <button type="button" className={ui.btn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => void save()} disabled={saving}>
            {item ? (saving ? "Saving…" : "Save changes") : saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
