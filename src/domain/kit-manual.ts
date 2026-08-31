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
