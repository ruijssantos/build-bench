"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteManual } from "@/app/(bench)/kits/actions";
import { CheckIcon, ExternalLinkIcon, EyeIcon, FileIcon, TrashIcon } from "@/components/icons";
import styles from "@/components/wishlist/Wishlist.module.css";
import type { KitManualRow } from "@/db/repositories/kit-manuals";
import { formatTimestampDate } from "@/domain/dates";
import { manualLabel } from "@/domain/kit-manual";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One manual: label, filename, size — plus what you do with it. "Open" (a
 * plain link, works on phone and desktop alike — a PDF opens in whatever the
 * browser's own viewer is) and, desktop-only, an inline toggle that embeds
 * the same PDF in an `<iframe>` without leaving the page. The desktop-only
 * pieces are wrapped in `.deskOnly` rather than applied to the button/iframe
 * directly — both already declare their own `display`, and a second class
 * fighting over that same property on the same element is fragile.
 */
export function ManualRow({ manual, kitId }: { manual: KitManualRow; kitId: number }) {
  const router = useRouter();
  const [viewing, setViewing] = useState(false);
  const [extracting, startExtract] = useTransition();
  const [extractError, setExtractError] = useState<string | null>(null);
  const [pendingDelete, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function runExtract() {
    setExtractError(null);
    startExtract(async () => {
      try {
        const res = await fetch("/api/kits/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manualId: manual.id, kitId }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!data.ok) {
          setExtractError(data.error ?? "Extraction failed — try again.");
          return;
        }
        // The route revalidates its cache tags, but this was a `fetch` from a
        // client component — nothing re-renders the server tree on its own, so
        // without this the Paints panel keeps showing its empty state and this
        // button keeps saying "Extract paint list" after a run that worked.
        router.refresh();
      } catch {
        setExtractError("Extraction hit a problem — try again.");
      }
    });
  }

  function runDelete() {
    setDeleteError(null);
    startDelete(async () => {
      try {
        const result = await deleteManual(manual.id, kitId);
        if (!result.ok) {
          setDeleteError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setDeleteError("Couldn't remove that manual — try again.");
      }
    });
  }

  return (
    <div className={styles.manualRow}>
      <div className={styles.manualTop}>
        <span className={styles.manualIcon}>
          <FileIcon size={17} />
        </span>
        <div className={styles.manualInfo}>
          <div className={styles.cardChips}>
            <span className={styles.chip}>{manualLabel(manual.label)}</span>
          </div>
          <div className={styles.manualName}>{manual.filename ?? "manual.pdf"}</div>
          <div className={styles.manualMeta}>
            {formatBytes(manual.sizeBytes)} · uploaded {formatTimestampDate(manual.uploadedAt)}
            {manual.paintsExtractedAt ? ` · paints extracted ${formatTimestampDate(manual.paintsExtractedAt)}` : ""}
          </div>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          title="Remove manual"
          aria-label={`Remove ${manual.filename ?? "manual"}`}
          disabled={pendingDelete}
          onClick={runDelete}
        >
          <TrashIcon size={15} />
        </button>
      </div>

      <div className={styles.manualActions}>
        <a className={styles.boughtButton} href={manual.blobUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLinkIcon size={13} /> Open
        </a>
        <span className={styles.deskOnly}>
          <button type="button" className={styles.boughtButton} onClick={() => setViewing((v) => !v)}>
            <EyeIcon size={13} /> {viewing ? "Hide" : "View"}
          </button>
        </span>
        {manual.paintsExtractedAt ? (
          <button
            type="button"
            className={`${styles.boughtButton} ${styles.boughtButtonDone}`}
            disabled={extracting}
            onClick={() => void runExtract()}
          >
            <CheckIcon size={13} /> {extracting ? "Re-extracting…" : "Extracted — re-run"}
          </button>
        ) : (
          <button type="button" className={styles.boughtButton} disabled={extracting} onClick={() => void runExtract()}>
            <FileIcon size={13} /> {extracting ? "Extracting…" : "Extract paint list"}
          </button>
        )}
      </div>

      {extractError ? <div className={styles.cardError}>{extractError}</div> : null}
      {deleteError ? <div className={styles.cardError}>{deleteError}</div> : null}

      {viewing ? (
        <span className={styles.deskOnly}>
          <iframe src={manual.blobUrl} title={manual.filename ?? "Manual"} className={styles.manualViewer} />
        </span>
      ) : null}
    </div>
  );
}
