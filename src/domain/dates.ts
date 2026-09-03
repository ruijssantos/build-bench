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

/**
 * The other direction: a `<input type="date">` value on its way *into* a
 * Postgres `date` column, or `null`.
 *
 * The date fields on the kit detail page used to go in through `readText`,
 * which trims and caps a string but has no opinion about what's in it. A
 * browser's own date input can only ever produce "YYYY-MM-DD" or "", so from
 * the screen that was always fine — but a Server Action is a public endpoint,
 * and anything else reaching the column raises `invalid input syntax for type
 * date` from Neon, which surfaces as an unhandled rejection rather than as
 * one of this app's own error strings.
 *
 * Checked by round trip rather than by regex alone: "2026-02-31" matches any
 * shape test you'd write and is not a day. `Date.UTC` normalises it to 3
 * March, so re-formatting and comparing is what actually catches it.
 */
export function readIsoDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const [year, month, day] = trimmed.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

/** A `timestamptz` column (`uploaded_at`, `paints_extracted_at`) → the same
 * display format, read in UTC so server and client agree. The day a manual
 * was uploaded doesn't need to be timezone-correct to the viewer; it needs to
 * be the *same* day in both renders. */
export function formatTimestampDate(value: Date | null): string | null {
  if (!value) return null;
  return formatIsoDate(new Date(value).toISOString().slice(0, 10));
}
