"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { updateKitArt } from "@/app/(bench)/kits/actions";
import { Modal } from "@/components/bench/Modal";
import { CameraIcon } from "@/components/icons";
import formStyles from "@/components/inventory/InventoryForm.module.css";
import { resizeImage } from "@/lib/resize-image";

import styles from "./Wishlist.module.css";

const MAX_PHOTO_EDGE = 1600;
const UPLOAD_TIMEOUT_MS = 30_000;

/** The dialog behind `ArtEditButton` — its own chunk, fetched only on click
 * (docs/PERFORMANCE.md §4: rarely-used interactive UI is lazy), the same
 * rule that already keeps `ManualKitDialog` out of every card's own bundle. */
export function ArtEditDialog({ kitId, onClose }: { kitId: number; onClose: () => void }) {
  const [phase, setPhase] = useState<"idle" | "uploading" | "fetching">("idle");
  const busy = phase !== "idle";
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onPhotoChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setPhase("uploading");
    try {
      const resized = await resizeImage(file, MAX_PHOTO_EDGE);
      setPreview(URL.createObjectURL(resized));

      const body = new FormData();
      body.append("file", resized);
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
      const result = await updateKitArt(kitId, data.url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } catch {
      setError("Couldn't upload that photo — try again.");
    } finally {
      setPhase("idle");
    }
  }

  async function fetchFromUrl() {
    if (!photoUrl.trim()) return;
    setError(null);
    setPhase("fetching");
    try {
      const result = await updateKitArt(kitId, photoUrl);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } catch {
      // Without this the rejection escapes into the `void fetchFromUrl()` call
      // site as an unhandled promise rejection and the button just returns to
      // "Fetch" with nothing said — indistinguishable from a no-op.
      setError("Couldn't fetch that image — try again.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <Modal title="Change photo" onClose={onClose}>
      <div className={formStyles.form}>
        <div className={styles.photoField}>
          <div className={styles.photoPreview}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not one next/image can optimise
              <img src={preview} alt="" className={styles.photoPreviewImg} />
            ) : (
              <CameraIcon size={22} />
            )}
          </div>
          <button
            type="button"
            className={styles.photoUploadButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {phase === "uploading" ? "Uploading…" : "Choose a photo"}
          </button>
          <input
            ref={fileInputRef}
            className={styles.srOnly}
            type="file"
            accept="image/*"
            onChange={(e) => void onPhotoChosen(e)}
            disabled={busy}
          />
        </div>

        <div className={styles.photoUrlRow}>
          <input
            className={formStyles.input}
            type="url"
            placeholder="…or paste an image address"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            disabled={busy}
            aria-label="Image address"
          />
          <button
            type="button"
            className={styles.photoUploadButton}
            onClick={() => void fetchFromUrl()}
            disabled={busy || !photoUrl.trim()}
          >
            {phase === "fetching" ? "Fetching…" : "Fetch"}
          </button>
        </div>

        {error ? <div className={formStyles.error}>{error}</div> : null}

        <div className={formStyles.actions}>
          <div className={formStyles.spacer} />
          <button type="button" className={formStyles.ghostButton} onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
