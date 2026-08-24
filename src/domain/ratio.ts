/**
 * Ratio, cup-fill and thinner-warning maths — ported from the prototype's
 * `R{}` table and its render()/paintNumbers() logic (docs/reference/
 * tamiya-thinner-bench-prototype.html). Pure functions only; no I/O.
 */

/** A row from `ratio_rule`, or the shape the repository hands back. */
export interface RatioRuleLike {
  family: string;
  thinnerType: string | null;
  paintParts: number | null;
  thinnerParts: number | null;
  windowLo: number | null;
  windowHi: number | null;
  psiText: string | null;
  coatsText: string | null;
  distanceText: string | null;
  notes: string[] | null;
}

/** A row from `ratio_override`, or null when none applies. */
export interface RatioOverrideLike {
  paintParts: number | null;
  thinnerParts: number | null;
  psiText: string | null;
  reason: string | null;
}

export interface EffectiveRatio {
  paintParts: number;
  thinnerParts: number;
  windowLo: number | null;
  windowHi: number | null;
  psiText: string | null;
  coatsText: string | null;
  distanceText: string | null;
  notes: string[];
  isOverridden: boolean;
  overrideReason: string | null;
}

/** Millilitres per drop through a 0.3 mm needle — the prototype's constant. */
export const ML_PER_DROP = 0.05;

/** The additive family (X-20A, X-21) has no ratio of its own — it *is* the thinner/agent. */
export function isAdditiveFamily(rule: Pick<RatioRuleLike, "family">): boolean {
  return rule.family === "additive";
}

/** Merge a family's base ratio rule with an optional correction, override winning. */
export function resolveEffectiveRatio(
  rule: RatioRuleLike,
  override?: RatioOverrideLike | null,
): EffectiveRatio | null {
  if (rule.paintParts == null || rule.thinnerParts == null) return null;
  return {
    paintParts: override?.paintParts ?? rule.paintParts,
    thinnerParts: override?.thinnerParts ?? rule.thinnerParts,
    windowLo: rule.windowLo,
    windowHi: rule.windowHi,
    psiText: override?.psiText ?? rule.psiText,
    coatsText: rule.coatsText,
    distanceText: rule.distanceText,
    notes: rule.notes ?? [],
    isOverridden: Boolean(override),
    overrideReason: override?.reason ?? null,
  };
}

/** "1.25" → "1.25", "1.00" → "1", "1.50" → "1.5" — the prototype's `rt()`. */
export function formatRatioNumber(n: number): string {
  if (Math.abs(n - Math.round(n)) < 0.01) return String(Math.round(n));
  return n.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
}

/**
 * The workable-window band is always drawn at the same fixed position on the
 * track (25%–60%) regardless of family — only the dot moves, mapped
 * proportionally onto that band from where the current ratio sits relative
 * to [windowLo, windowHi]. A ratio outside the window (e.g. after an
 * override) can push the dot past the band's edges.
 */
export const WINDOW_BAND_LEFT_PCT = 25;
export const WINDOW_BAND_WIDTH_PCT = 35;

/** 0–100% position for the track dot, or null when the family has no window. */
export function windowPosition(ratio: EffectiveRatio): number | null {
  if (ratio.windowLo == null || ratio.windowHi == null) return null;
  const span = ratio.windowHi - ratio.windowLo;
  if (span <= 0) return null;
  const fraction = (ratio.thinnerParts - ratio.windowLo) / span;
  const pct = WINDOW_BAND_LEFT_PCT + fraction * WINDOW_BAND_WIDTH_PCT;
  return Math.min(100, Math.max(0, pct));
}

export interface CupFill {
  paintDrops: number;
  thinnerDrops: number;
  totalMl: number;
  totalMlText: string;
  pctOfCup: number;
  overCapacity: boolean;
}

/** Drops of paint → drops of thinner → ml → % of the rig's cup, with an over-capacity flag. */
export function calculateCupFill(
  paintDrops: number,
  ratio: Pick<EffectiveRatio, "paintParts" | "thinnerParts">,
  cupCc: number,
): CupFill {
  const thinnerDrops = Math.round(paintDrops * (ratio.thinnerParts / ratio.paintParts) * 10) / 10;
  const totalMl = (paintDrops + thinnerDrops) * ML_PER_DROP;
  const pctOfCup = cupCc > 0 ? (totalMl / cupCc) * 100 : 0;
  return {
    paintDrops,
    thinnerDrops,
    totalMl,
    totalMlText: totalMl.toFixed(2).replace(/0$/, "").replace(/\.$/, ""),
    pctOfCup,
    overCapacity: totalMl > cupCc,
  };
}

export type ThinnerWarningSeverity = "stop" | "info";

export interface ThinnerWarning {
  severity: ThinnerWarningSeverity;
  title: string;
  message: string;
}

/**
 * The lacquer-vs-acrylic warning (and the enamel / plain-acrylic notes), keyed off
 * `ratio_rule.thinner_type` rather than a hardcoded family list, so a new lacquer-side
 * family added later gets the warning for free. Matches the prototype's `LACFAM` /
 * `res.fam==="enamel"` branch exactly — only the lacquer case is a "stop".
 */
export function thinnerWarningFor(thinnerType: string | null): ThinnerWarning | null {
  switch (thinnerType) {
    case "lacquer_retarder":
      return {
        severity: "stop",
        title: "Wrong thinner on the bench",
        message:
          "Your acrylic retarder will curdle this one. It needs Tamiya Lacquer Thinner, retarder type, for the same slow flash.",
      };
    case "enamel_x20":
      return {
        severity: "info",
        title: "Enamel thinner, not acrylic",
        message: "Enamel takes X-20 enamel thinner, not the acrylic retarder bottle.",
      };
    case "acrylic_retarder":
      return {
        severity: "info",
        title: "Retarder note",
        message:
          "Retarder thinner runs slightly richer than plain X-20A here, and it is what keeps a 0.3 mm nozzle from drying out mid-panel. In a cold or damp room, back off to the drier end of the window.",
      };
    default:
      return null;
  }
}
