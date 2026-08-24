import { buildPaintSearchIndex, searchPaintIndex } from "@/domain/paint-search";

import catalogueSeed from "../../../seed/paints.tamiya.json";

/**
 * The type-ahead index, in the browser.
 *
 * Search used to cost a debounced `fetch` per keystroke, which meant a Neon
 * HTTP round trip per keystroke — the query itself was trivial, the network
 * hop was the whole latency. The catalogue is a few hundred rows that change
 * only on deploy, so the browser can just have it: ~5 kB over the wire once,
 * then every keystroke answers locally in microseconds.
 *
 * This module is only ever reached through `await import()` from the search
 * box, so the catalogue is fetched when someone first goes to search — never
 * as part of first load. Do not import it statically from anywhere.
 */

interface SeedPaint {
  code: string;
  name: string;
  hex: string;
  family: string;
  finish: string | null;
}

export interface PaintHit {
  code: string;
  name: string | null;
  hex: string | null;
  family: string;
  finish: string | null;
}

const INDEX = buildPaintSearchIndex(
  (catalogueSeed as SeedPaint[]).map(
    (row): PaintHit => ({
      code: row.code,
      name: row.name,
      hex: row.hex,
      family: row.family,
      finish: row.finish,
    }),
  ),
);

export function searchPaints(query: string, limit = 8): PaintHit[] {
  return searchPaintIndex(INDEX, query, limit);
}
