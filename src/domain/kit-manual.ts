/**
 * Manual label vocabulary — docs/PLAN.md §6 Phase 4a, the `kit_manual.label`
 * column added in migration 0004.
 *
 * Free text on the row (a kit can need a label this list doesn't anticipate),
 * so this is suggestions for the upload picker, not an enum the column is
 * constrained to — same shape as `kit.category` before it.
 */

export const MANUAL_LABELS = ["Instructions", "Decal guide", "Painting guide", "Other"] as const;
export type ManualLabel = (typeof MANUAL_LABELS)[number];

/** The one size ceiling a manual answers to, shared by the upload route
 * (`/api/kits/manuals/upload-token`) and paint extraction
 * (`/api/kits/extract`) — docs/PLAN.md §6 Phase 4a, §4.3. Generous, not
 * tight: real manuals run 10–40 MB. Extraction used to enforce a second,
 * much tighter ~20 MB ceiling of its own — the Anthropic request limit
 * after base64 inflation — which meant a manual could upload fine and then
 * never be extractable. Extraction now sends the PDF through the Files API
 * instead of inlining it as base64 (500 MB per file there), so that second
 * ceiling no longer applies: if it's stored, it can be extracted. */
export const MAX_MANUAL_UPLOAD_BYTES = 45 * 1024 * 1024;

export function manualLabel(label: string | null): string {
  return label?.trim() || "Manual";
}

/**
 * How many pages of a manual paint extraction reads by default.
 *
 * Every page of a PDF costs twice: the API converts each one to an **image**
 * and extracts its text alongside, so a page runs 1,500–3,000 text tokens plus
 * image tokens whether or not it has anything to say. A 24-page manual is
 * therefore most of a kit's extraction bill, and almost all of it is exploded
 * assembly diagrams.
 *
 * Five pages, because of how these manuals are actually laid out: the paint
 * chart — every colour the kit calls for, with codes, plus the cross-brand
 * equivalence table and any custom mixes — sits in the front matter. The
 * assembly steps that follow *reference* those codes; they do not introduce
 * new ones. So the pages after the chart cost image tokens to tell extraction
 * something it already read.
 *
 * That is a rule about the common case, not a law — a few boxings put the
 * chart at the back. Which is why this is a default with a way out rather than
 * a cap: extraction reports whether it actually found a chart, and the manual
 * row offers a full read when it didn't. See `/api/kits/extract`.
 */
export const DEFAULT_EXTRACT_PAGES = 5;
