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

/** Line rank for the default paint ordering — mirrors `SHELF_ORDER` in
 * `db/repositories/inventory.ts` exactly (line prefix, then the code's own
 * digits as a number, then the string) so a paint sorts the same way here
 * as it does on the Paints screen. Kept in sync by hand rather than shared
 * code: that one is a SQL `case`/`regexp_replace` built for `.orderBy()`,
 * this one is a plain comparator for in-memory arrays — different enough
 * mechanisms that sharing one implementation would mean wrapping SQL to
 * satisfy a JS caller or vice versa, for three lines of logic. */
const LINE_RANK: Record<string, number> = { X: 0, XF: 1, LP: 2, TS: 3, AS: 4, PS: 5 };

function paintSortKey(code: string): readonly [number, number] {
  const prefix = (code.match(/^[A-Z]+/) ?? [""])[0];
  const rank = LINE_RANK[prefix] ?? 6;
  const numeric = Number(code.replace(/[^0-9]/g, "")) || 0;
  return [rank, numeric] as const;
}

/** Default paint ordering: by line (X, XF, LP, TS, AS, PS, then anything
 * else), then numerically within the line, then the code itself as a final
 * tie-break. Plain `localeCompare` alone sorts "X-2" after "X-19" — this is
 * what both the Paints screen and a kit's Owned/Missing chips use instead. */
export function comparePaintCodes(a: string, b: string): number {
  const [aRank, aNum] = paintSortKey(a);
  const [bRank, bNum] = paintSortKey(b);
  if (aRank !== bRank) return aRank - bRank;
  if (aNum !== bNum) return aNum - bNum;
  return a.localeCompare(b);
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
