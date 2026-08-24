/**
 * Ratio and cup-fill maths — ported from the prototype's `R{}` table and its
 * render()/paintNumbers() logic (docs/reference/
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
 * track (25%–60%) regardless of family — the numbers above and the "Drier /
 * Wetter" labels either side already say where the current ratio sits, so
 * the band alone is enough here.
 */
export const WINDOW_BAND_LEFT_PCT = 25;
export const WINDOW_BAND_WIDTH_PCT = 35;

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
  const thinnerDrops = Math.round(paintDrops * (ratio.thinnerParts / ratio.paintParts));
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
