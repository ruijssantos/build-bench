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

export function manualLabel(label: string | null): string {
  return label?.trim() || "Manual";
}
