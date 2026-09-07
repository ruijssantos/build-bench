import { z } from "zod";

import { getCataloguePaint } from "@/catalogue/paints";
import { resolveForeignCode } from "@/catalogue/equivalents";

/**
 * The Claude paint-extraction wire schema — docs/PLAN.md §6 Phase 4a, §4.3.
 *
 * Same reasoning as `./kit-candidate.ts`'s `ResolveResultSchema`: the wire
 * shape is looser than what the app actually stores, because a strict schema
 * throws away a whole paid call over one off-vocabulary line (§7). The model
 * is asked for the label exactly as printed plus its best guess at the code
 * token within it; resolution against the real catalogue happens here, not
 * in the prompt, so a model typo in casing or a stray space doesn't cost a
 * paint its match.
 */

const ExtractedPaintWireSchema = z.object({
  rawLabel: z.string(),
  codeGuess: z.string().nullish(),
});

export const PaintExtractionResultSchema = z.object({
  requirements: z.array(ExtractedPaintWireSchema),
  /**
   * Did the pages it was given actually contain the kit's paint chart?
   *
   * Extraction reads only the first few pages by default
   * (`DEFAULT_EXTRACT_PAGES`), on the rule that the chart lives in the front
   * matter. This is how the app finds out when that rule didn't hold for a
   * particular boxing — without it, a chart at the back of the manual would
   * come back as a short list and no error, which is the same thing as being
   * wrong quietly. The route turns a `false` here into an offer to read the
   * whole file.
   */
  foundPaintChart: z
    .boolean()
    .describe("true if these pages contained the kit's paint/colour chart, false if not"),
});

export interface ExtractedPaintRequirement {
  rawLabel: string;
  /** Resolved against `src/catalogue/paints.ts` first, then, for a code
   * that isn't itself Tamiya's, against `src/catalogue/equivalents.ts`
   * (Phase 5, docs/PLAN.md §2.2) — `null` only when neither knows it, which
   * for a code the cross-reference chart never covered is the expected
   * case, not an error. */
  paintCode: string | null;
}

/** A Tamiya-code-shaped token inside a raw label — "X-11 CHROME SILVER" or
 * "13. Chrome Silver (X-11)" both carry one. Tried when the model's own
 * `codeGuess` doesn't resolve, since the code is often present in the label
 * even when the model's separate guess at it wasn't clean. */
const CODE_IN_TEXT = /\b(X|XF|LP|TS|AS|PS)-?\d+[A-Z]?\b/i;

/** Tamiya's own line prefixes, for the guard in `foreignCodeInLabel`. */
const TAMIYA_LINES = new Set(["X", "XF", "LP", "TS", "AS", "PS"]);

/**
 * A foreign-brand code at the *head* of the label — "H4 イエロー YELLOW",
 * "C68 モンザレッド RED MADDER".
 *
 * Anchored at the start deliberately. That is where every manual prints the
 * code, and anchoring is what makes this safe to try at all: scanning the
 * whole line would read the "1:1" of a mixing ratio, or a part number, as a
 * paint.
 *
 * A Tamiya-shaped prefix is rejected rather than looked up. If the label
 * leads with "X-99" then it is a Tamiya callout this app's catalogue happens
 * not to carry, and answering it with Xtracolour's unrelated X099 would be a
 * fabricated match — exactly the failure the cross-brand chart's own parser
 * guards against.
 */
const FOREIGN_CODE_AT_START = /^([A-Za-z]{1,3})-?(\d{1,3})\b/;

export function foreignCodeInLabel(rawLabel: string): string | null {
  const match = FOREIGN_CODE_AT_START.exec(rawLabel.trim());
  if (!match) return null;
  const line = match[1]!.toUpperCase();
  if (TAMIYA_LINES.has(line)) return null;
  return `${line}${match[2]}`;
}

/**
 * The label is the reliable half of what extraction returns; `codeGuess` is
 * the model's separate opinion about which token in it is the code, and it is
 * not always there. A run that returned clean labels and no `codeGuess` at
 * all left every callout on a Japanese kit unresolved — the chart had the
 * answers, nothing asked it the question. So the code is recovered from the
 * label too, and the two are tried in order.
 */
function resolveCode(rawLabel: string, codeGuess: string | null | undefined): string | null {
  for (const candidate of [codeGuess, CODE_IN_TEXT.exec(rawLabel)?.[0]]) {
    if (!candidate) continue;
    const paint = getCataloguePaint(candidate);
    if (paint) return paint.code;
  }
  // Not a Tamiya code the catalogue knows directly — the common case for a
  // Japanese kit, whose manual calls out Mr. Color/Mr. Hobby throughout.
  for (const candidate of [codeGuess, foreignCodeInLabel(rawLabel)]) {
    if (!candidate) continue;
    const equivalent = resolveForeignCode(candidate);
    if (equivalent) return equivalent;
  }
  return null;
}

function clean(value: string | null | undefined, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

/** One raw callout → the app's own shape, or `null` for a line too empty to
 * be worth a row (a model can echo a blank table cell as `rawLabel: ""`). */
function normalizeExtractedPaint(
  raw: z.infer<typeof ExtractedPaintWireSchema>,
): ExtractedPaintRequirement | null {
  const rawLabel = clean(raw.rawLabel, 200);
  if (!rawLabel) return null;

  return {
    rawLabel,
    paintCode: resolveCode(rawLabel, raw.codeGuess),
  };
}

/** The whole result: normalised, empties dropped, codes resolved against the
 * real catalogue. No cap on count — a manual's full paint list is the point,
 * unlike a ranked kit search's candidates. */
export function normalizeExtractedPaints(
  raw: z.infer<typeof PaintExtractionResultSchema>,
): ExtractedPaintRequirement[] {
  return raw.requirements
    .map(normalizeExtractedPaint)
    .filter((row): row is ExtractedPaintRequirement => row !== null);
}
