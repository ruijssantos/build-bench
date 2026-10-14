"use client";

import { useRef, useState } from "react";

import { createManualForKit } from "@/app/(bench)/kits/actions";
import { PlusIcon } from "@/components/icons";
import formStyles from "@/components/bench/Form.module.css";
import type { KitManualRow } from "@/db/repositories/kit-manuals";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

import { ManualRow } from "./ManualRow";

/** Vercel's serverless request-body limit — the ceiling on the fallback
 * path (`/api/kits/manuals/upload`), same reasoning as that route's own
 * comment. Checked client-side too, so a manual too big for the fallback
 * fails with a clear reason instead of a 413 with no context. */
const FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

/**
 * The Manuals panel's client half — the upload button (which opens the file
 * picker straight away: no label picker, no dropzone step in between) plus
 * the list of `ManualRow`s. A fresh upload goes straight on to paint
 * extraction: the new row is rendered with `autoExtract`, and runs the same
 * extraction its own button does — so the feedback ("Extracting…", an error,
 * the "read the whole manual" offer) is exactly what a click would give.
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
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [autoExtractId, setAutoExtractId] = useState<number | null>(null);
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
      const result = await createManualForKit({ kitId, blobUrl, filename: file.name, sizeBytes: file.size });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAutoExtractId(result.manualId);
    } catch (err) {
      console.error("[manual-upload] failed:", err);
      setError("Couldn't upload that manual — try again.");
    } finally {
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <>
      <div className={page.subHead}>
        <span className={ui.moduleTitle}>Manuals ({manuals.length})</span>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSm}`}
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {busy ? null : <PlusIcon size={14} />}
          {phase === "uploading" ? "Uploading…" : phase === "saving" ? "Saving…" : "Upload manual"}
        </button>
        <input
          ref={fileInputRef}
          className={ui.srOnly}
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>

      {error ? <div className={formStyles.error}>{error}</div> : null}

      {manuals.length === 0 ? <div className={page.emptyCard}>No manuals uploaded yet.</div> : null}

      {manuals.map((manual) => (
        <ManualRow
          key={manual.id}
          manual={manual}
          kitId={kitId}
          autoExtract={manual.id === autoExtractId}
          onAutoExtractStarted={() => setAutoExtractId(null)}
        />
      ))}
    </>
  );
}
