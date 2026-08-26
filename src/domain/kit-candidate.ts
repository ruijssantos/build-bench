import { z } from "zod";

import { isKitCategory, type KitCategory } from "./kit";

/**
 * The one definition of a resolved kit candidate — docs/PLAN.md §5.1 stage A.
 *
 * The resolve route, the Server Action that saves a pick, and the client that
 * renders the cards all hang off this file. It used to be three separate
 * declarations that had already drifted apart (`category: string` on one side,
 * an enum on another, different nullability on a third), so adding a field
 * meant editing three places and skipping one still type-checked.
 *
 * The client imports `KitCandidate` with `import type`, which TypeScript
 * erases — so Zod never reaches a browser bundle despite living here.
 *
 * **Why the wire schema is looser than the app's own vocabulary.**
 * `zodOutputFormat` does not send `enum` or `maxItems` to the API — both are
 * demoted to prose in the schema's description and enforced nowhere. So the
 * model is free to answer `category: "armor"` (US spelling, against a system
 * prompt that says "armour"), `"military"`, or eleven candidates, and a strict
 * schema would throw away a whole 10–20s, $0.02–0.05 search over one word.
 * The wire schema therefore accepts what the API can actually produce and
 * `normalizeCandidate` coerces it — the same `isKitCategory(…) ?? "other"`
 * fallback the save path already applies.
 */

/** §5.1 caps the ranked list; enforced here because the API won't. */
export const MAX_CANDIDATES = 10;

const CandidateWireSchema = z.object({
  brand: z.string(),
  kitNumber: z.string().nullish(),
  name: z.string(),
  scale: z.string().nullish(),
  category: z.string().nullish(),
  scalematesUrl: z.string().nullish(),
  imageUrl: z.string().nullish(),
});

export const ResolveResultSchema = z.object({
  candidates: z.array(CandidateWireSchema),
});

export interface KitCandidate {
  brand: string;
  kitNumber: string | null;
  name: string;
  scale: string | null;
  category: KitCategory;
  scalematesUrl: string | null;
  imageUrl: string | null;
}

function clean(value: string | null | undefined, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

/**
 * One raw candidate → the app's own shape, or `null` for a row too empty to
 * be worth showing. Brand and name are the identity a card leads with and the
 * minimum `saveKitCandidate` will accept, so a candidate missing either is
 * dropped rather than rendered as "Untitled kit".
 */
function normalizeCandidate(raw: z.infer<typeof CandidateWireSchema>): KitCandidate | null {
  const brand = clean(raw.brand, 200);
  const name = clean(raw.name, 200);
  if (!brand || !name) return null;

  return {
    brand,
    kitNumber: clean(raw.kitNumber, 200),
    name,
    scale: clean(raw.scale, 40),
    category: isKitCategory(raw.category) ? raw.category : "other",
    scalematesUrl: clean(raw.scalematesUrl, 500),
    imageUrl: clean(raw.imageUrl, 2000),
  };
}

/** The whole result: normalised, empties dropped, capped at `MAX_CANDIDATES`. */
export function normalizeCandidates(raw: z.infer<typeof ResolveResultSchema>): KitCandidate[] {
  return raw.candidates
    .map(normalizeCandidate)
    .filter((candidate): candidate is KitCandidate => candidate !== null)
    .slice(0, MAX_CANDIDATES);
}
