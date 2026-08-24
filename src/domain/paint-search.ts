/**
 * Paint-code type-ahead — index construction, ranking and matching. Pure:
 * no I/O, and no catalogue data of its own.
 *
 * Two callers build an index over the same rows: the server, from the
 * compiled catalogue (`src/catalogue/paints.ts`), and the browser, from the
 * lazily-loaded chunk behind the search box. Keeping the ranking here means
 * one implementation serves both, so a typed query resolves identically
 * whether it was answered locally or over the wire.
 */

export interface SearchablePaint {
  code: string;
  name: string | null;
  hex: string | null;
  family: string;
  finish: string | null;
}

interface IndexedPaint<T extends SearchablePaint> {
  row: T;
  /** "XF-64" → "XF64": what a typed query is prefix-matched against, so
   * "xf6", "XF 6" and "xf-6" all behave the same. */
  compact: string;
  lowerName: string;
  /** "XF-64" → "XF" and 64 — the two keys results are ordered by. */
  line: string;
  number: number;
}

export type PaintSearchIndex<T extends SearchablePaint> = ReadonlyArray<IndexedPaint<T>>;

/** "xf-64" / "XF 64" → "XF64". */
export function compactPaintCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function buildPaintSearchIndex<T extends SearchablePaint>(rows: readonly T[]): PaintSearchIndex<T> {
  return rows.map((row) => {
    const match = row.code.match(/^([A-Za-z]+)-?(\d+)/);
    return {
      row,
      compact: compactPaintCode(row.code),
      lowerName: (row.name ?? "").toLowerCase(),
      line: (match?.[1] ?? row.code).toUpperCase(),
      number: match ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
    };
  });
}

/**
 * Ranking tiers, best first. A code match always beats a name match: someone
 * typing "x-1" wants X-1, not every paint with an "x" in its name.
 */
const RANK_NO_MATCH = -1;
const RANK_CODE_EXACT = 0;
const RANK_CODE_PREFIX = 1;
const RANK_NAME_EXACT = 2;
const RANK_NAME_PREFIX = 3;
const RANK_NAME_WORD = 4;
const RANK_NAME_SUBSTRING = 5;

function rank<T extends SearchablePaint>(
  entry: IndexedPaint<T>,
  codeQuery: string,
  nameQuery: string,
): number {
  if (entry.compact === codeQuery) return RANK_CODE_EXACT;
  if (entry.compact.startsWith(codeQuery)) return RANK_CODE_PREFIX;

  if (entry.lowerName === nameQuery) return RANK_NAME_EXACT;

  const at = entry.lowerName.indexOf(nameQuery);
  if (at < 0) return RANK_NO_MATCH;
  if (at === 0) return RANK_NAME_PREFIX;
  return entry.lowerName[at - 1] === " " ? RANK_NAME_WORD : RANK_NAME_SUBSTRING;
}

/** Within a tier: line prefix alphabetically ("X" before "XF"), then the code
 * number as a *number* — so X-2 sorts before X-19, which a text sort gets wrong. */
function compare<T extends SearchablePaint>(a: IndexedPaint<T>, b: IndexedPaint<T>): number {
  if (a.line !== b.line) return a.line < b.line ? -1 : 1;
  if (a.number !== b.number) return a.number - b.number;
  return a.row.code < b.row.code ? -1 : a.row.code > b.row.code ? 1 : 0;
}

/**
 * Whole-index scan. At catalogue scale (a few hundred rows) this is tens of
 * microseconds — far cheaper than the prefix-tree it would take to beat it,
 * and it costs no network hop at all, which is the part that was slow.
 */
export function searchPaintIndex<T extends SearchablePaint>(
  index: PaintSearchIndex<T>,
  query: string,
  limit = 8,
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const codeQuery = compactPaintCode(trimmed);
  const nameQuery = trimmed.toLowerCase();

  const hits: Array<{ entry: IndexedPaint<T>; tier: number }> = [];
  for (const entry of index) {
    const tier = rank(entry, codeQuery, nameQuery);
    if (tier !== RANK_NO_MATCH) hits.push({ entry, tier });
  }

  hits.sort((a, b) => a.tier - b.tier || compare(a.entry, b.entry));
  return hits.slice(0, limit).map((hit) => hit.entry.row);
}
