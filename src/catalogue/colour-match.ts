import { CATALOGUE } from "@/catalogue/paints";

import gunzeSeed from "../../seed/gunze-colours.json";

/**
 * "Nothing in the chart lists this code — what's the nearest Tamiya paint?"
 *
 * This is the last resort behind `./equivalents.ts`, and it is a different
 * kind of answer, which is the important thing about it. A chart row is a
 * *published equivalence*: somebody compared the two paints and said they
 * match. What this module computes is a *colour distance* between two screen
 * swatches. It belongs in the Unresolved bucket as a suggestion to check, and
 * it must never be promoted into Owned or Missing, because "the closest thing
 * Tamiya makes" and "the paint this kit calls for" are not the same claim
 * (docs/PLAN.md §5.4).
 *
 * Two honest limits, both worth stating rather than burying:
 *
 *  - A swatch is how a chart chose to *depict* a paint on a screen. It is not
 *    a spectrophotometer reading, and both sides of the comparison inherit
 *    that.
 *  - Distance knows nothing about finish, metallic flake, or transparency.
 *    A clear orange and an opaque orange can sit a couple of ΔE apart and
 *    behave nothing alike on the model. The finish is rendered alongside every
 *    suggestion so the reader can apply the judgement the number can't.
 *
 * CIEDE2000 rather than plain Euclidean RGB distance because RGB distance is
 * badly non-uniform — it rates two dark colours as far apart as two mid greens
 * that look obviously different — and picking a wrong paint confidently is the
 * failure this whole area keeps producing.
 */

interface SeedColour {
  code: string;
  hex: string;
}

export interface ColourMatch {
  code: string;
  name: string;
  hex: string;
  /** Tamiya's own `finish` — gloss | flat | semi | metallic | clear. Null
   * for the handful of catalogue rows that don't carry one. */
  finish: string | null;
  /** CIEDE2000. Under ~2 is a close match, ~5 is recognisably the same
   * colour, past ~10 it is a different colour that happens to be nearest. */
  deltaE: number;
}

// ---------------------------------------------------------------------------
// sRGB → CIELAB (D65)
// ---------------------------------------------------------------------------

export type Lab = [number, number, number];

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB companding — the gamma curve, undone. */
function linearise(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexToLab(hex: string): Lab | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(linearise) as [number, number, number];

  // sRGB D65 primaries.
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27) * t / 116 + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// ---------------------------------------------------------------------------
// CIEDE2000
// ---------------------------------------------------------------------------

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Sharma/Wu/Dalal formulation, kL = kC = kH = 1.
 *
 * Exported for `scripts/verify-catalogue.ts`, which checks it against the
 * published test pairs from that paper. This formula has several places where
 * a wrong answer still looks like a plausible one — the hue-average wrap
 * around 360°, and the arctangent quadrant — so "the numbers came out
 * reasonable" is not evidence it is right.
 */
export function deltaE2000(a: Lab, b: Lab): number {
  const [L1, a1, b1] = a;
  const [L2, a2, b2] = b;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const cBar = (C1 + C2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));

  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = C1p === 0 ? 0 : (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = C2p === 0 ? 0 : (deg(Math.atan2(b2, a2p)) + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const LpBar = (L1 + L2) / 2;
  const CpBar = (C1p + C2p) / 2;

  let hpBar = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hpBar += h1p + h2p < 360 ? 360 : -360;
    hpBar /= 2;
  }

  const t =
    1 -
    0.17 * Math.cos(rad(hpBar - 30)) +
    0.24 * Math.cos(rad(2 * hpBar)) +
    0.32 * Math.cos(rad(3 * hpBar + 6)) -
    0.2 * Math.cos(rad(4 * hpBar - 63));

  const sL = 1 + (0.015 * (LpBar - 50) ** 2) / Math.sqrt(20 + (LpBar - 50) ** 2);
  const sC = 1 + 0.045 * CpBar;
  const sH = 1 + 0.015 * CpBar * t;

  const rt =
    -2 *
    Math.sqrt(CpBar ** 7 / (CpBar ** 7 + 25 ** 7)) *
    Math.sin(rad(60 * Math.exp(-(((hpBar - 275) / 25) ** 2))));

  return Math.sqrt(
    (dLp / sL) ** 2 + (dCp / sC) ** 2 + (dHp / sH) ** 2 + rt * (dCp / sC) * (dHp / sH),
  );
}

// ---------------------------------------------------------------------------
// The indexes
// ---------------------------------------------------------------------------

const GUNZE_HEX = new Map<string, string>();
for (const c of gunzeSeed as SeedColour[]) GUNZE_HEX.set(c.code.toUpperCase(), c.hex);

/** The Gunze swatch for a code as printed on the bottle ("H4", "C68"), or
 * null. Zero-padding is normalised the same way `./equivalents.ts` does it. */
export function gunzeColour(rawCode: string): string | null {
  const key = rawCode.toUpperCase().replace(/\s+/g, "");
  const prefixed = /^([A-Z]+)0*(\d+)$/.exec(key);
  return GUNZE_HEX.get(prefixed ? `${prefixed[1]}${prefixed[2]}` : key) ?? null;
}

const TAMIYA_LAB: Array<{
  code: string;
  name: string;
  hex: string;
  finish: string | null;
  lab: Lab;
}> = [];
for (const paint of CATALOGUE) {
  const lab = hexToLab(paint.hex);
  if (lab) {
    TAMIYA_LAB.push({
      code: paint.code,
      name: paint.name,
      hex: paint.hex,
      finish: paint.finish,
      lab,
    });
  }
}

/**
 * Past this the nearest paint is simply the least distant one, not a
 * candidate, and offering it would be worse than saying nothing — the whole
 * point of the Unresolved bucket is that an honest gap beats a bad guess.
 */
const MAX_DELTA_E = 12;

/** The closest Tamiya paints to a colour, nearest first, or empty when
 * nothing is close enough to be worth showing. */
export function nearestTamiyaPaints(hex: string, limit = 3): ColourMatch[] {
  const target = hexToLab(hex);
  if (!target) return [];

  return TAMIYA_LAB.map((paint) => ({
    code: paint.code,
    name: paint.name,
    hex: paint.hex,
    finish: paint.finish,
    deltaE: deltaE2000(target, paint.lab),
  }))
    .filter((m) => m.deltaE <= MAX_DELTA_E)
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, limit);
}
