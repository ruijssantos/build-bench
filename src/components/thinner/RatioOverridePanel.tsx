"use client";

import { useState } from "react";

import { saveRatioOverride } from "@/app/(bench)/thinner/actions";

import styles from "./RatioHero.module.css";

/**
 * The correct-this-ratio form. Its own chunk, loaded when the pencil is
 * clicked: it's three inputs, validation and a mutation that most sessions
 * never touch, and none of it needs to be in the bundle that paints the screen.
 */
export function RatioOverridePanel({
  code,
  paintParts,
  thinnerParts,
  onClose,
}: {
  code: string;
  paintParts: number;
  thinnerParts: number;
  onClose: () => void;
}) {
  const [paintInput, setPaintInput] = useState(String(paintParts));
  const [thinnerInput, setThinnerInput] = useState(String(thinnerParts));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const paint = Number(paintInput);
    const thinner = Number(thinnerInput);
    if (!Number.isFinite(paint) || paint <= 0 || !Number.isFinite(thinner) || thinner <= 0) {
      setError("Enter two positive numbers.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await saveRatioOverride({
        code,
        paintParts: paint,
        thinnerParts: thinner,
        reason: reason.trim() || undefined,
      });
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
    <div className={styles.editPanel}>
      <div className={styles.editRow}>
        <div className={styles.editField}>
          <label className={styles.editLabel} htmlFor="override-paint-parts">
            Paint
          </label>
          <input
            id="override-paint-parts"
            className={styles.editInput}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.05"
            value={paintInput}
            onChange={(e) => setPaintInput(e.target.value)}
          />
        </div>
        <div className={styles.editField}>
          <label className={styles.editLabel} htmlFor="override-thinner-parts">
            Thinner
          </label>
          <input
            id="override-thinner-parts"
            className={styles.editInput}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.05"
            value={thinnerInput}
            onChange={(e) => setThinnerInput(e.target.value)}
          />
        </div>
      </div>
      <div className={styles.editField}>
        <label className={styles.editLabel} htmlFor="override-reason">
          Why (optional)
        </label>
        <input
          id="override-reason"
          className={styles.editInput}
          type="text"
          placeholder="e.g. ran wetter in a damp workshop"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error ? <div className={styles.editError}>{error}</div> : null}
      <div className={styles.editActions}>
        <button
          type="button"
          className={styles.editButtonGhost}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.editButtonPrimary}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save correction"}
        </button>
      </div>
    </div>
  );
}
