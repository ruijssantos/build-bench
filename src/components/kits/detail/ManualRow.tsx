"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { deleteManual } from "@/app/(bench)/kits/actions";
import { CheckIcon, ExternalLinkIcon, FileIcon, TrashIcon } from "@/components/icons";
import styles from "@/components/kits/Kits.module.css";
import type { KitManualRow } from "@/db/repositories/kit-manuals";
import { DEFAULT_EXTRACT_PAGES } from "@/domain/kit-manual";
import ui from "@/styles/ui.module.css";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One manual: filename, size — plus what you do with it. Just "Open"
 * (a plain link, `target="_blank"`) and "Extract paint list" — there was
 * also an inline `<iframe>` viewer, desktop-only, but it duplicated what
 * "Open" already does (the browser's own PDF viewer, in a new tab) for the
 * cost of a second render path, so it's gone rather than fixed.
 */
export function ManualRow({
  manual,
  kitId,
  autoExtract = false,
  onAutoExtractStarted,
}: {
  manual: KitManualRow;
  kitId: number;
  /** Set on the row a fresh upload just created: extract once on arrival,
   * through the same path as the button. */
  autoExtract?: boolean;
  onAutoExtractStarted?: () => void;
}) {
  const router = useRouter();
  const [extracting, startExtract] = useTransition();
  const [extractError, setExtractError] = useState<string | null>(null);
  const [pendingDelete, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function runExtract(wholeManual = false) {
    setExtractError(null);
    startExtract(async () => {
      try {
        const res = await fetch("/api/kits/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manualId: manual.id, kitId, wholeManual }),
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

  // A ref, not just the parent clearing `autoExtract`: Strict Mode runs this
  // effect twice in development, and extraction is a paid API call.
  const autoExtractStarted = useRef(false);
  useEffect(() => {
    if (!autoExtract || autoExtractStarted.current || manual.paintsExtractedAt) return;
    autoExtractStarted.current = true;
    onAutoExtractStarted?.();
    void runExtract(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per arrival, not per render
  }, [autoExtract]);

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
          <div className={styles.manualName}>{manual.filename ?? "manual.pdf"}</div>
          <div className={styles.manualMeta}>
            {formatBytes(manual.sizeBytes)}
            {manual.pageCount ? ` · ${manual.pageCount} page${manual.pageCount === 1 ? "" : "s"}` : ""}
          </div>
        </div>
        <button
          type="button"
          className={`${ui.iconBtn} ${ui.iconBtnAlert}`}
          title="Remove manual"
          aria-label={`Remove ${manual.filename ?? "manual"}`}
          disabled={pendingDelete}
          onClick={runDelete}
        >
          <TrashIcon size={16} />
        </button>
      </div>

      <div className={styles.manualActions}>
        <a
          className={`${ui.btn} ${ui.btnSm}`}
          href={manual.blobUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLinkIcon size={14} /> Open
        </a>
        {manual.paintsExtractedAt ? (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSm} ${ui.btnOkOn}`}
            disabled={extracting}
            onClick={() => void runExtract(false)}
          >
            <CheckIcon size={14} /> {extracting ? "Re-extracting…" : "Extracted — re-run"}
          </button>
        ) : (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSm}`}
            disabled={extracting}
            onClick={() => void runExtract(false)}
          >
            <FileIcon size={14} /> {extracting ? "Extracting paints…" : "Extract paint list"}
          </button>
        )}
      </div>

      {/* The escape hatch. Extraction reads the first few pages by default,
          because that is where these manuals print their paint chart — and
          when a boxing doesn't, this is how that becomes visible instead of
          arriving as a quietly short list. Reading everything is the
          expensive path, so it happens only when asked for. */}
      {manual.paintsExtractedAt && manual.paintChartFound === false ? (
        <div className={styles.manualMeta}>
          No paint chart in the first {DEFAULT_EXTRACT_PAGES} pages
          {manual.pageCount ? ` of ${manual.pageCount}` : ""} — this manual may print it further in.{" "}
          <button
            type="button"
            className={ui.textBtn}
            disabled={extracting}
            onClick={() => void runExtract(true)}
          >
            {extracting ? "Reading…" : "Read the whole manual"}
          </button>
        </div>
      ) : null}

      {extractError ? <div className={styles.cardError}>{extractError}</div> : null}
      {deleteError ? <div className={styles.cardError}>{deleteError}</div> : null}
    </div>
  );
}
