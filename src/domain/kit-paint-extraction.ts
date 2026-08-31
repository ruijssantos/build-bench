import { z } from "zod";

import { getCataloguePaint } from "@/catalogue/paints";

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
  partHint: z.string().nullish(),
});

export const PaintExtractionResultSchema = z.object({
  requirements: z.array(ExtractedPaintWireSchema),
});

export interface ExtractedPaintRequirement {
  rawLabel: string;
  /** Resolved against `src/catalogue/paints.ts`; `null` when the callout
   * isn't a Tamiya code the catalogue knows — a non-Tamiya kit's Mr. Color
   * or Vallejo callouts are the expected case, not an error. */
  paintCode: string | null;
  partHint: string | null;
}

/** A Tamiya-code-shaped token inside a raw label — "X-11 CHROME SILVER" or
 * "13. Chrome Silver (X-11)" both carry one. Tried when the model's own
 * `codeGuess` doesn't resolve, since the code is often present in the label
 * even when the model's separate guess at it wasn't clean. */
const CODE_IN_TEXT = /\b(X|XF|LP|TS|AS|PS)-?\d+[A-Z]?\b/i;

function resolveCode(rawLabel: string, codeGuess: string | null | undefined): string | null {
  for (const candidate of [codeGuess, CODE_IN_TEXT.exec(rawLabel)?.[0]]) {
    if (!candidate) continue;
    const paint = getCataloguePaint(candidate);
    if (paint) return paint.code;
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
    partHint: clean(raw.partHint, 200),
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
