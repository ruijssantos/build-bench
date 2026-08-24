"use client";

import { useState } from "react";

import { PencilIcon } from "@/components/icons";
import {
  calculateCupFill,
  formatRatioNumber,
  windowPosition,
  WINDOW_BAND_LEFT_PCT,
  WINDOW_BAND_WIDTH_PCT,
  type EffectiveRatio,
} from "@/domain/ratio";
import type { ResolvedPaintIdentity } from "@/lib/thinner-bench";

import { familyLabel } from "./family-label";
import styles from "./RatioHero.module.css";

export interface OverrideInput {
  paintParts: number;
  thinnerParts: number;
  reason?: string;
}

export function RatioHero({
  paint,
  ratio,
  cupCc,
  drops,
  onDropsChange,
  canOverride,
  onSaveOverride,
}: {
  paint: ResolvedPaintIdentity;
  ratio: EffectiveRatio;
  cupCc: number;
  drops: number;
  onDropsChange: (drops: number) => void;
  canOverride: boolean;
  onSaveOverride: (input: OverrideInput) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [paintPartsInput, setPaintPartsInput] = useState(String(ratio.paintParts));
  const [thinnerPartsInput, setThinnerPartsInput] = useState(String(ratio.thinnerParts));
  const [reasonInput, setReasonInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cupFill = calculateCupFill(drops, ratio, cupCc);
  const dotPct = windowPosition(ratio);

  function startEdit() {
    setPaintPartsInput(String(ratio.paintParts));
    setThinnerPartsInput(String(ratio.thinnerParts));
    setReasonInput("");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const paintParts = Number(paintPartsInput);
    const thinnerParts = Number(thinnerPartsInput);
    if (!Number.isFinite(paintParts) || paintParts <= 0 || !Number.isFinite(thinnerParts) || thinnerParts <= 0) {
      setError("Enter two positive numbers.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveOverride({
        paintParts,
        thinnerParts,
        reason: reasonInput.trim() || undefined,
      });
      setEditing(false);
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.liveryStrip}>
        <div className={styles.liveryBar1} />
        <div className={styles.liveryGap} />
        <div className={styles.liveryBar2} />
      </div>

      <div className={styles.body}>
        <div className={styles.identityRow}>
          <div className={styles.swatch} style={{ background: paint.hex }} />

          <div className={styles.identityPhone}>
            <div className={styles.code}>{paint.code}</div>
            <div className={styles.familyLine}>{familyLabel(paint.family)}</div>
          </div>

          <div className={styles.identityDesktop}>
            <div className={styles.code}>{paint.code}</div>
            <div className={styles.name}>{paint.name}</div>
          </div>
          <div className={styles.familyLabelDesktop}>{familyLabel(paint.family)}</div>
        </div>

        <div className={styles.ratioSection}>
          <div className={styles.ratioHeader}>
            <div className={styles.ratioLabel}>Starting ratio · paint to thinner</div>
            {canOverride && !editing ? (
              <button
                type="button"
                className={styles.editButton}
                onClick={startEdit}
                aria-label="Correct this ratio"
                title="Correct this ratio"
              >
                <PencilIcon size={15} />
              </button>
            ) : null}
          </div>
          <div className={styles.ratioNumbers}>
            <span className={styles.num}>{formatRatioNumber(ratio.paintParts)}</span>
            <span className={styles.colon}>:</span>
            <span className={`${styles.num} ${styles.numAccent}`}>
              {formatRatioNumber(ratio.thinnerParts)}
            </span>
          </div>
          {ratio.isOverridden ? (
            <div className={styles.overriddenNote}>
              Corrected from the default{ratio.overrideReason ? ` — ${ratio.overrideReason}` : ""}
            </div>
          ) : null}

          {editing ? (
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
                    value={paintPartsInput}
                    onChange={(e) => setPaintPartsInput(e.target.value)}
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
                    value={thinnerPartsInput}
                    onChange={(e) => setThinnerPartsInput(e.target.value)}
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
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                />
              </div>
              {error ? <div className={styles.editError}>{error}</div> : null}
              <div className={styles.editActions}>
                <button
                  type="button"
                  className={styles.editButtonGhost}
                  onClick={() => setEditing(false)}
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
          ) : null}
        </div>

        {ratio.windowLo != null && ratio.windowHi != null ? (
          <div className={styles.windowSection}>
            <div className={styles.track}>
              <div
                className={styles.trackFill}
                style={{ left: `${WINDOW_BAND_LEFT_PCT}%`, width: `${WINDOW_BAND_WIDTH_PCT}%` }}
              />
              {dotPct != null ? (
                <div className={styles.trackDot} style={{ left: `${dotPct}%` }} />
              ) : null}
            </div>
            <div className={styles.windowLabels}>
              <span className={styles.windowLabel}>Drier {formatRatioNumber(ratio.windowLo)}</span>
              <span className={styles.windowMid}>Workable window</span>
              <span className={styles.windowLabel}>{formatRatioNumber(ratio.windowHi)} Wetter</span>
            </div>
          </div>
        ) : null}

        <div className={styles.divider} />

        <div>
          <div className={styles.cupHeader}>
            <span className={styles.cupHeaderLeft}>
              {cupFill.paintDrops} drops paint <span className={styles.plus}>+</span>{" "}
              {cupFill.thinnerDrops} thinner
            </span>
            <span className={styles.cupHeaderRight}>
              {cupFill.totalMlText} ml
              <span className={styles.pctInline}>
                {" "}
                · {Math.round(cupFill.pctOfCup)}% of the {cupCc} cc cup
              </span>
            </span>
          </div>
          <div className={styles.cupBar}>
            <div
              className={styles.cupBarFill}
              style={{
                width: `${Math.min(100, cupFill.pctOfCup)}%`,
                background: paint.hex,
              }}
            />
          </div>
          <div className={`${styles.cupCaption} ${cupFill.overCapacity ? styles.overCapacity : ""}`}>
            {Math.round(cupFill.pctOfCup)}% of the {cupCc} cc cup
            {cupFill.overCapacity ? " — over capacity, mix in two batches" : ""}
          </div>

          <div className={styles.sliderRow}>
            <input
              className={styles.slider}
              type="range"
              min={5}
              max={80}
              step={1}
              value={drops}
              onChange={(e) => onDropsChange(Number(e.target.value))}
              aria-label="Drops of paint"
            />
            <span className={styles.sliderLabel}>drops of paint</span>
          </div>
        </div>
      </div>
    </div>
  );
}
