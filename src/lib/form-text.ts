/**
 * Trims and caps a possibly-untyped form value, `null` when empty or absent.
 * Shared by every kit and wishlist mutation that reads free text off a form
 * or a Server Action's plain-object input — kept in one place so the same
 * rule (trim, cap, empty reads as unset) applies everywhere it's read.
 */
export function readText(raw: unknown, maxLen = 200): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}
