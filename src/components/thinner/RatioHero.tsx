"use client";

import { lazy, Suspense, useState } from "react";

import { PencilIcon } from "@/components/icons";
import {
  calculateCupFill,
  formatRatioNumber,
  WINDOW_BAND_LEFT_PCT,
  WINDOW_BAND_WIDTH_PCT,
  type EffectiveRatio,
} from "@/domain/ratio";
import type { ResolvedPaintIdentity } from "@/lib/thinner-bench";

import { familyLabel } from "./family-label";
import styles from "./RatioHero.module.css";

/**
 * Client because of the drops slider — the cup maths has to follow the thumb,
 * which is the one genuinely interactive thing on this card. Everything the
 * correction form needs lives in a chunk that loads on the pencil click.
 */
const RatioOverridePanel = lazy(() =>
  import("./RatioOverridePanel").then((m) => ({ default: m.RatioOverridePanel })),
);

export function RatioHero({
  paint,
  ratio,
  cupCc,
}: {
  paint: ResolvedPaintIdentity;
  ratio: EffectiveRatio;
  cupCc: number;
}) {
  const [drops, setDrops] = useState(20);
  const [editing, setEditing] = useState(false);

  const cupFill = calculateCupFill(drops, ratio, cupCc);

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
            {paint.known && !editing ? (
              <button
                type="button"
                className={styles.editButton}
                onClick={() => setEditing(true)}
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
            <span className={styles.num}>{formatRatioNumber(ratio.thinnerParts)}</span>
          </div>
          {ratio.isOverridden ? (
            <div className={styles.overriddenNote}>
              Corrected from the default{ratio.overrideReason ? ` — ${ratio.overrideReason}` : ""}
            </div>
          ) : null}

          {editing ? (
            <Suspense fallback={null}>
              <RatioOverridePanel
                code={paint.code}
                paintParts={ratio.paintParts}
                thinnerParts={ratio.thinnerParts}
                onClose={() => setEditing(false)}
              />
            </Suspense>
          ) : null}
        </div>

        {ratio.windowLo != null && ratio.windowHi != null ? (
          <div className={styles.windowSection}>
            <div className={styles.track}>
              <div
                className={styles.trackFill}
                style={{ left: `${WINDOW_BAND_LEFT_PCT}%`, width: `${WINDOW_BAND_WIDTH_PCT}%` }}
              />
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
          <div className={styles.sliderRow}>
            <input
              className={styles.slider}
              type="range"
              min={5}
              max={80}
              step={1}
              value={drops}
              onChange={(e) => setDrops(Number(e.target.value))}
              aria-label="Drops of paint"
            />
            <span className={styles.sliderLabel}>drops of paint</span>
          </div>

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
        </div>
      </div>
    </div>
  );
}
