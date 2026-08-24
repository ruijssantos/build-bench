/**
 * Paint code normalisation and line-prefix inference — ported from the
 * prototype's `norm()` / `familyFromPrefix()` (docs/reference/
 * tamiya-thinner-bench-prototype.html).
 */

export type RatioFamily =
  | "gloss"
  | "flat"
  | "semi"
  | "metallic"
  | "clear"
  | "lacquer"
  | "sprayDecant"
  | "polycarb"
  | "enamel"
  | "primer"
  | "additive";

/** "xf64" / "XF 64" / "xf-64" → "XF-64". Non-matching input passes through uppercased. */
export function normalizePaintCode(raw: string): string {
  const s = raw.toUpperCase().replace(/\s+/g, "");
  const m = s.match(/^([A-Z]+)-?(\d+[A-Z]?)$/);
  return m ? `${m[1]}-${m[2]}` : s;
}

/** Fallback ratio family for a code the catalogue doesn't know, from its line prefix alone. */
export function familyFromLinePrefix(code: string): RatioFamily | null {
  const prefix = (code.match(/^[A-Z]+/) ?? [""])[0];
  switch (prefix) {
    case "LP":
      return "lacquer";
    case "TS":
    case "AS":
      return "sprayDecant";
    case "PS":
      return "polycarb";
    case "XF":
      return "flat";
    case "X":
      return "gloss";
    default:
      return null;
  }
}
