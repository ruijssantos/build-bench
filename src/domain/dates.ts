/**
 * Date formatting for display — deliberately hand-rolled rather than
 * `toLocaleDateString`.
 *
 * These strings are rendered on the server first and hydrated on the client,
 * and `toLocaleDateString` resolves against whatever timezone (and locale)
 * the *rendering environment* has: UTC in a Vercel function, the viewer's own
 * zone in the browser. For a timestamp near midnight that produces two
 * different dates for the same value — a React hydration mismatch, and a
 * visibly wrong date on the screen. Formatting from the ISO parts is stable
 * everywhere.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06-18" → "18 Jun 2026". Anything unparseable passes through as-is,
 * which is the honest answer for a value this function can't read. */
export function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  const monthIndex = Number(month) - 1;
  if (!year || !MONTHS[monthIndex] || !day) return iso;
  return `${Number(day)} ${MONTHS[monthIndex]} ${year}`;
}

/** A `timestamptz` column (`uploaded_at`, `paints_extracted_at`) → the same
 * display format, read in UTC so server and client agree. The day a manual
 * was uploaded doesn't need to be timezone-correct to the viewer; it needs to
 * be the *same* day in both renders. */
export function formatTimestampDate(value: Date | null): string | null {
  if (!value) return null;
  return formatIsoDate(new Date(value).toISOString().slice(0, 10));
}
