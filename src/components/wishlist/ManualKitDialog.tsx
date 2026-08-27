"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { addManualKit, fetchKitArt, updateManualKit } from "@/app/(bench)/wishlist/actions";
import { Modal } from "@/components/bench/Modal";
import { KitsIcon } from "@/components/icons";
import formStyles from "@/components/inventory/InventoryForm.module.css";
import type { KitRow } from "@/db/repositories/kits";
import { categoryLabel, KIT_CATEGORIES } from "@/domain/kit";
import { resizeImage } from "@/lib/resize-image";

import styles from "./Wishlist.module.css";

/** Long edge, in pixels, an uploaded photo is resized down to before it
 * leaves the browser (see `resizeImage`). Generous for a card thumbnail,
 * and it keeps a phone photo's several megabytes down to a few hundred kB —
 * which is what lets `/api/kits/upload` take the file directly instead of
 * needing Blob's large-file upload path. */
const MAX_PHOTO_EDGE = 1600;

/** Bounds the upload so a stalled request surfaces as an error instead of
 * leaving the dialog on "Uploading…" forever. */
const UPLOAD_TIMEOUT_MS = 30_000;

/**
 * Manual kit entry — always available (docs/PLAN.md §6 Phase 3), for
 * anything the search can't place. Its own chunk, fetched only once "Add a
 * kit by hand" (or a saved kit's Edit) is actually clicked.
 *
 * The same form drives both add and edit: pass a `kit` to pre-fill it and
 * save through `updateManualKit` instead of `addManualKit`. A photo picker
 * only appears when the kit has no box art yet — a resolved or already
 * hand-uploaded photo isn't replaced from here.
 */
export function ManualKitDialog({ kit, onClose }: { kit?: KitRow; onClose: () => void }) {
  const editing = kit != null;

  const [brand, setBrand] = useState(kit?.brand ?? "");
  const [kitNumber, setKitNumber] = useState(kit?.kitNumber ?? "");
  const [name, setName] = useState(kit?.name ?? "");
  const [scale, setScale] = useState(kit?.scale ?? "1:24");
  const [category, setCategory] = useState<string>(kit?.category ?? "cars");
  const [scalematesUrl, setScalematesUrl] = useState(kit?.scalematesUrl ?? "");
  const [notes, setNotes] = useState(kit?.notes ?? "");
  /** Split from a single `saving` boolean so a stuck save is visible as
   * "Uploading…" vs "Saving…" rather than one undifferentiated state. */
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving" | "fetching">("idle");
  const saving = phase !== "idle";
  const [error, setError] = useState<string | null>(null);
  /** What the last "Fetch from link" press did, shown in place of the photo
   * hint — a failure here is usually the site refusing us, which is worth
   * saying out loud rather than leaving as an empty frame. */
  const [fetchNote, setFetchNote] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The preview is an object URL — it needs releasing when replaced or when
  // the dialog closes, or it outlives the file it points at.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function onPhotoChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be re-picked after an error
    if (!file) return;
    try {
      const resized = await resizeImage(file, MAX_PHOTO_EDGE);
      setPhotoFile(resized);
      setPhotoPreview(URL.createObjectURL(resized));
    } catch {
      setError("Couldn't read that photo — try a different file.");
    }
  }

  /** Reads the art off the link now, rather than hoping a save does it
   * quietly. Closes on success so the refreshed card shows the picture. */
  async function fetchFromLink() {
    if (!kit) return;
    setPhase("fetching");
    setError(null);
    setFetchNote(null);
    try {
      const result = await fetchKitArt(kit.id, scalematesUrl);
      if (!result.ok) {
        setFetchNote(result.error);
        return;
      }
      onClose();
    } catch {
      setFetchNote("Couldn't fetch that — try again.");
    } finally {
      setPhase("idle");
    }
  }

  async function save() {
    if (!brand.trim() || !name.trim()) {
      setError("Give it at least a brand and a name.");
      return;
    }
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (photoFile) {
        setPhase("uploading");
        try {
          const body = new FormData();
          body.append("file", photoFile);
          const res = await fetch("/api/kits/upload", {
            method: "POST",
            body,
            signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
          });
          const data = (await res.json()) as { ok: true; url: string } | { ok: false; error: string };
          if (!data.ok) {
            setError(data.error);
            return;
          }
          imageUrl = data.url;
        } catch (uploadError) {
          console.error("Kit photo upload failed:", uploadError);
          setError("Couldn't upload that photo — try again.");
          return;
        }
      }

      setPhase("saving");
      const result =
        editing && kit
          ? await updateManualKit({ id: kit.id, brand, kitNumber, name, scale, category, scalematesUrl, notes, imageUrl })
          : await addManualKit({ brand, kitNumber, name, scale, category, scalematesUrl, notes });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } catch (saveError) {
      console.error("Kit save failed:", saveError);
      setError("Couldn't save that — try again.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <Modal title={editing ? "Edit kit" : "Add a kit by hand"} onClose={onClose}>
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
            Link
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

        {!kit?.imageUrl ? (
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="manual-kit-photo">
              Photo
            </label>
            <div className={styles.photoField}>
              <div className={styles.photoPreview}>
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not one next/image can optimise
                  <img src={photoPreview} alt="" className={styles.photoPreviewImg} />
                ) : (
                  <KitsIcon size={22} />
                )}
              </div>
              <button
                type="button"
                className={styles.photoUploadButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                {photoFile ? "Choose a different photo" : "Choose a photo"}
              </button>
              {/* Only for a kit that already exists: fetching art writes
                  straight to the row, so there has to be a row. */}
              {editing && kit && scalematesUrl.trim() && !photoFile ? (
                <button
                  type="button"
                  className={styles.photoUploadButton}
                  onClick={() => void fetchFromLink()}
                  disabled={saving}
                >
                  {phase === "fetching" ? "Fetching…" : "Fetch from link"}
                </button>
              ) : null}
              <input
                ref={fileInputRef}
                id="manual-kit-photo"
                className={styles.srOnly}
                type="file"
                accept="image/*"
                onChange={(e) => void onPhotoChosen(e)}
                disabled={saving}
              />
            </div>
            <span className={styles.photoHint}>
              {fetchNote ?? "Optional — resized automatically from your computer."}
            </span>
          </div>
        ) : null}

        {error ? <div className={formStyles.error}>{error}</div> : null}

        <div className={formStyles.actions}>
          <div className={formStyles.spacer} />
          <button type="button" className={formStyles.ghostButton} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={formStyles.primaryButton} onClick={() => void save()} disabled={saving}>
            {phase === "uploading"
              ? "Uploading photo…"
              : phase === "saving"
                ? editing
                  ? "Saving…"
                  : "Adding…"
                : editing
                  ? "Save changes"
                  : "Add kit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
