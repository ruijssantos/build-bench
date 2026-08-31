"use client";

import { useRef, useState } from "react";

import { createManualForKit } from "@/app/(bench)/kits/actions";
import { PlusIcon, UploadIcon } from "@/components/icons";
import formStyles from "@/components/inventory/InventoryForm.module.css";
import inventoryStyles from "@/components/inventory/Inventory.module.css";
import styles from "@/components/wishlist/Wishlist.module.css";
import type { KitManualRow } from "@/db/repositories/kit-manuals";
import { MANUAL_LABELS, type ManualLabel } from "@/domain/kit-manual";

import { ManualRow } from "./ManualRow";

/** Vercel's serverless request-body limit — the ceiling on the fallback
 * path (`/api/kits/manuals/upload`), same reasoning as that route's own
 * comment. Checked client-side too, so a manual too big for the fallback
 * fails with a clear reason instead of a 413 with no context. */
const FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

/**
 * The Manuals panel's client half — upload (open state, the label picker,
 * the file input) plus the list of `ManualRow`s. One component rather than
 * a separate trigger-in-header/dropzone-in-body split: both need the same
 * `uploadOpen` state, and there's nothing here a server boundary would save
 * (every manual row needs its own client interactivity regardless).
 *
 * Upload tries `upload()` from `@vercel/blob/client` first — client-direct
 * to Blob, no size worry for the file itself (docs/PLAN.md §4.3: real
 * manuals run 10–40 MB). If that fails, it falls back to a plain POST at
 * `/api/kits/manuals/upload`, capped at ~4 MB by Vercel's own serverless
 * request-body limit — and says so plainly rather than leaving a silent
 * "Uploading…" (docs/PLAN.md §7's lesson from box art: every failure path
 * needs a real reason). Either way, the `kit_manual` row is written by a
 * Server Action called after the upload resolves, not from Blob's own
 * `onUploadCompleted` — see `upload-token/route.ts`'s comment.
 */
export function ManualsList({ kitId, manuals }: { kitId: number; manuals: KitManualRow[] }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [label, setLabel] = useState<ManualLabel>(MANUAL_LABELS[0]);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("That file isn't a PDF.");
      return;
    }
    setError(null);
    setPhase("uploading");

    try {
      let blobUrl: string;
      try {
        const { upload } = await import("@vercel/blob/client");
        const result = await upload(`kits/manuals/${crypto.randomUUID()}.pdf`, file, {
          access: "public",
          handleUploadUrl: "/api/kits/manuals/upload-token",
          contentType: "application/pdf",
        });
        blobUrl = result.url;
      } catch (directError) {
        console.error("[manual-upload] direct upload failed, falling back:", directError);
        if (file.size > FALLBACK_MAX_BYTES) {
          setError(
            `Direct upload to storage failed, and this manual (${(file.size / (1024 * 1024)).toFixed(1)} MB) is too large for the standard fallback path (4 MB). Try again, ideally on a different connection.`,
          );
          return;
        }
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/kits/manuals/upload", { method: "POST", body });
        const data = (await res.json()) as { ok: true; url: string } | { ok: false; error: string };
        if (!data.ok) {
          setError(data.error);
          return;
        }
        blobUrl = data.url;
      }

      setPhase("saving");
      const result = await createManualForKit({ kitId, blobUrl, filename: file.name, label, sizeBytes: file.size });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUploadOpen(false);
    } catch (err) {
      console.error("[manual-upload] failed:", err);
      setError("Couldn't upload that manual — try again.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <>
      <div className={styles.subHead}>
        <span className={styles.moduleTitle}>Manuals ({manuals.length})</span>
        <button type="button" className={styles.manualButton} onClick={() => setUploadOpen((o) => !o)}>
          <PlusIcon size={11} /> Upload manual
        </button>
      </div>

      {manuals.length === 0 && !uploadOpen ? <div className={inventoryStyles.emptyCard}>No manuals uploaded yet.</div> : null}

      {manuals.map((manual) => (
        <ManualRow key={manual.id} manual={manual} kitId={kitId} />
      ))}

      {uploadOpen ? (
        <div className={styles.dropzone}>
          <UploadIcon size={22} />
          <span className={styles.moduleTitle}>Choose a PDF</span>
          <div className={inventoryStyles.filters}>
            {MANUAL_LABELS.map((l) => (
              <button
                key={l}
                type="button"
                className={`${inventoryStyles.filterPill} ${label === l ? inventoryStyles.filterPillActive : ""}`}
                onClick={() => setLabel(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${formStyles.primaryButton} ${styles.dropzoneUpload}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={phase !== "idle"}
          >
            {phase === "uploading" ? "Uploading…" : phase === "saving" ? "Saving…" : "Choose a file"}
          </button>
          <input
            ref={fileInputRef}
            className={styles.srOnly}
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
          {error ? <div className={formStyles.error}>{error}</div> : null}
        </div>
      ) : null}
    </>
  );
}
