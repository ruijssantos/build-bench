import chartSeed from "../../seed/tamiya-lp-chart.json";

/**
 * LP (lacquer) and TS (spray) codes → the X/XF acrylic Tamiya itself lists as
 * the same colour. Source: Tamiya's "LP Color Compatibility Chart" (2024.4
 * edition, tamiyausa.com/media/files/lp-color-compatibility-chart-521-1238-1963.pdf),
 * one row per LP colour with an Acrylic, Enamel, TS and AS column.
 *
 * `seed/tamiya-lp-chart.json` keeps the 51 rows that have an Acrylic entry,
 * with that row's TS where it has one:
 * - **LP → X/XF** is the chart read directly.
 * - **TS → X/XF** is read across a row: when Tamiya puts X-18 and TS-29 on
 *   the same LP-5 row, it is saying both are that colour. 31 rows have both.
 *   A TS colour the chart doesn't list (TS-36, say — no LP twin) gets no
 *   match here; that is missing data, not a claim that none exists.
 *
 * AS, enamel and LP↔TS are left out on purpose: the owner's rule is "I have
 * the equivalent in X or XF", so the acrylic bottle is the only thing a
 * callout is ever matched to.
 *
 * This is a different relationship from `./equivalents.ts`, and deliberately
 * not folded into it. That file answers "which Tamiya paint is this foreign
 * code", and resolves a callout to one code at extraction time. This one
 * answers "I don't own the paint the manual asks for — do I own its acrylic
 * twin?", which depends on the shelf and so is decided on read, never stored:
 * the requirement keeps the code the manual printed, and buying or using up
 * the X/XF bottle moves it between Missing and Equivalents on its own.
 */

interface ChartRow {
  lp_code: string;
  acrylic_code: string;
  ts_code: string | null;
}

/** Every (called-for code, acrylic twin) pair, LP and TS alike. */
export const ACRYLIC_TWIN_PAIRS: readonly (readonly [code: string, acrylic: string])[] = (
  chartSeed as ChartRow[]
).flatMap((row) => [
  [row.lp_code, row.acrylic_code] as const,
  ...(row.ts_code ? [[row.ts_code, row.acrylic_code] as const] : []),
]);

const BY_CODE = new Map(ACRYLIC_TWIN_PAIRS);

/** The X/XF acrylic Tamiya matches to this LP or TS code, or `null` for any
 * code the chart gives no acrylic for (including every X/XF code itself). */
export function acrylicTwin(code: string): string | null {
  return BY_CODE.get(code) ?? null;
}
