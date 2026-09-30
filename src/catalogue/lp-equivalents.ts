import lpSeed from "../../seed/lp-acrylic-equivalents.json";

/**
 * Tamiya LP (lacquer) code → the X/XF acrylic Tamiya itself lists as the same
 * colour. Source: Tamiya's "LP Color Compatibility Chart" (2024.4 edition,
 * tamiyausa.com/media/files/lp-color-compatibility-chart-521-1238-1963.pdf),
 * the Acrylic column only — 51 of LP-1…LP-85 have one; the rest are matched
 * only by a TS/AS spray, or by nothing.
 *
 * This is a different relationship from `./equivalents.ts`, and deliberately
 * not folded into it. That file answers "which Tamiya paint is this foreign
 * code", and resolves a callout to one code at extraction time. This one
 * answers "I don't own the LP the manual asks for — do I own its acrylic
 * twin?", which depends on the shelf and so is decided on read, never stored:
 * the requirement keeps the code the manual printed, and buying or using up
 * the X/XF bottle moves it between Missing and Equivalents on its own.
 *
 * Sprays are left out on purpose. The owner's rule is "I have the equivalent
 * in X or XF"; a TS can is a different way of applying paint, not a bottle to
 * reach for instead.
 */

interface SeedRow {
  lp_code: string;
  acrylic_code: string;
}

export const LP_ACRYLIC_PAIRS: readonly (readonly [lp: string, acrylic: string])[] = (
  lpSeed as SeedRow[]
).map((row) => [row.lp_code, row.acrylic_code] as const);

const BY_LP = new Map(LP_ACRYLIC_PAIRS);

/** The X/XF acrylic Tamiya matches to this LP code, or `null` for any code
 * that isn't an LP with an acrylic match (including every non-LP code). */
export function acrylicForLp(code: string): string | null {
  return BY_LP.get(code) ?? null;
}
