import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Turns mech9's Gunze paint-conversion pages into
 * `scripts/data/mech9-gunze-tamiya.json`, the second source behind
 * `seed/equivalents.json` (docs/PLAN.md §2.2).
 *
 * Usage — one PDF per GSI line, both saved from mech9.com by printing the
 * page to PDF (the site is not reachable from where this runs, the same
 * constraint that made the Cybermodeler fixture a hand-supplied export):
 *
 *   npx tsx scripts/parse-mech9-tables.mts H aqueous-conversion.pdf \
 *                                          C mr-color-conversion.pdf
 *
 * Needs `pdftotext` (poppler-utils; `brew install poppler`).
 *
 * ## How the page is read
 *
 * Each page is one very wide HTML table. A source paint owns a row; its code
 * sits alone in the leftmost column and its equivalents fill a grid to the
 * right, wrapped over several sub-rows. Every equivalent cell stacks the
 * colour name, then "(code)", then the brand across one or more lines.
 *
 * Two things about that are easy to get wrong, and both were got wrong first:
 *
 * 1. **A Tamiya-shaped code is not necessarily Tamiya.** Xtracolour numbers
 *    its paints X001..X354 — the same shape as Tamiya's X-1..X-35. So a code
 *    only counts when the word "Tamiya" is sitting where its cell's brand
 *    line would be. Dropping that check silently invents equivalences.
 *
 * 2. **Row bands come from the page's whitespace, not from the anchors.**
 *    Splitting halfway between one code and the next assumes each code is
 *    centred in its row; row heights vary with how many equivalents a colour
 *    has, so that bleeds across the boundary. It gave H86 (Monza Red) the
 *    TS-68 Wooden Deck Tan belonging to the row above — a confidently wrong
 *    paint, which is worse than no answer at all. Measured gaps: 21pt between
 *    lines in a cell, 35pt between wrapped sub-rows, 47pt+ between rows, so
 *    splitting at 45pt cuts exactly at row boundaries.
 */

interface Word {
  page: number;
  x: number;
  y: number;
  text: string;
}

interface ParsedRow {
  code: string;
  name: string | null;
  tamiya: string[];
}

/** Anchors sit at x 56-63, the first data column starts at x 152. An earlier
 * cutoff of 160 quietly swallowed 57 of the page's 401 codes. */
const LEFT_COLUMN_MAX_X = 120;
const ROW_GAP = 45;

/** Tamiya's own code shapes — see caveat 1 above about Xtracolour. */
const TAMIYA_CODE = /^\((X|XF|LP|TS|AS|PS)-?(\d{1,3})\)$/i;

function wordsFromPdf(pdfPath: string): Word[] {
  const out = join(mkdtempSync(join(tmpdir(), "mech9-")), "page.xml");
  execFileSync("pdftotext", ["-bbox-layout", pdfPath, out], { stdio: ["ignore", "ignore", "pipe"] });
  const xml = readFileSync(out, "utf-8");

  const words: Word[] = [];
  let page = 0;
  const wordRe =
    /<page |<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  for (const m of xml.matchAll(wordRe)) {
    if (m[0].startsWith("<page ")) {
      page++;
      continue;
    }
    words.push({
      page,
      x: Number(m[1]),
      y: Number(m[2]),
      text: m[5]!.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
    });
  }
  return words;
}

/** Row bands per page, cut at the gaps between table rows. */
function rowBlocks(words: Word[]): Map<number, Array<[number, number]>> {
  const byPage = new Map<number, Word[]>();
  for (const w of words) {
    if (w.x < LEFT_COLUMN_MAX_X) continue;
    const list = byPage.get(w.page);
    if (list) list.push(w);
    else byPage.set(w.page, [w]);
  }

  const blocks = new Map<number, Array<[number, number]>>();
  for (const [page, pageWords] of byPage) {
    const ys = [...new Set(pageWords.map((w) => Math.round(w.y)))].sort((a, b) => a - b);
    const pageBlocks: Array<[number, number]> = [];
    let start = ys[0]!;
    for (let i = 1; i < ys.length; i++) {
      if (ys[i]! - ys[i - 1]! >= ROW_GAP) {
        pageBlocks.push([start, ys[i - 1]!]);
        start = ys[i]!;
      }
    }
    pageBlocks.push([start, ys[ys.length - 1]!]);
    blocks.set(page, pageBlocks);
  }
  return blocks;
}

function parse(pdfPath: string, prefix: string): ParsedRow[] {
  const words = wordsFromPdf(pdfPath);
  const blocks = rowBlocks(words);
  const anchorRe = new RegExp(`^\\(${prefix}(\\d{1,3})\\)$`);

  const anchors = words
    .filter((w) => w.x < LEFT_COLUMN_MAX_X && anchorRe.test(w.text))
    .map((w) => ({ ...w, code: `${prefix}${anchorRe.exec(w.text)![1]}` }))
    .sort((a, b) => a.page - b.page || a.y - b.y);

  const byCode = new Map<string, { name: string; tamiya: Set<string> }>();

  for (const anchor of anchors) {
    const pageBlocks = blocks.get(anchor.page) ?? [];
    // The block containing the anchor, else the nearest — a label can sit in
    // the whitespace between two blocks.
    const block =
      pageBlocks.find(([top, bottom]) => anchor.y >= top - 25 && anchor.y <= bottom + 25) ??
      pageBlocks.reduce(
        (best, b) =>
          Math.abs((b[0] + b[1]) / 2 - anchor.y) < Math.abs((best[0] + best[1]) / 2 - anchor.y)
            ? b
            : best,
        pageBlocks[0]!,
      );
    if (!block) continue;

    const rowWords = words.filter(
      (w) =>
        w.page === anchor.page && w.y >= block[0] && w.y <= block[1] && w.x >= LEFT_COLUMN_MAX_X,
    );

    const tamiya = new Set<string>();
    for (const w of rowWords) {
      const m = TAMIYA_CODE.exec(w.text);
      if (!m) continue;
      const brandIsTamiya = rowWords.some(
        (v) =>
          /^Tamiya$/i.test(v.text) &&
          Math.abs(v.x - w.x) < 70 &&
          v.y > w.y &&
          v.y - w.y < 50,
      );
      if (!brandIsTamiya) continue;
      tamiya.add(`${m[1]!.toUpperCase()}-${Number(m[2])}`);
    }
    if (tamiya.size === 0) continue;

    // The left cell stacks the colour name above the code, with the line's
    // boilerplate ("Aqueous / Hobby / Color / [i]") below it.
    const name = words
      .filter(
        (w) =>
          w.page === anchor.page &&
          w.x < LEFT_COLUMN_MAX_X &&
          w.y < anchor.y &&
          anchor.y - w.y < 70 &&
          w.text !== "[i]",
      )
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((w) => w.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const existing = byCode.get(anchor.code);
    if (existing) for (const t of tamiya) existing.tamiya.add(t);
    else byCode.set(anchor.code, { name, tamiya });
  }

  return [...byCode.entries()]
    .map(([code, { name, tamiya }]) => ({
      code,
      name: name || null,
      tamiya: [...tamiya].sort(),
    }))
    .sort((a, b) => Number(a.code.slice(1)) - Number(b.code.slice(1)));
}

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
  console.error("Usage: tsx scripts/parse-mech9-tables.mts <H|C> <pdf> [<H|C> <pdf> ...]");
  process.exit(1);
}

const rows: ParsedRow[] = [];
for (let i = 0; i < args.length; i += 2) {
  const prefix = args[i]!.toUpperCase();
  const parsed = parse(args[i + 1]!, prefix);
  console.log(`${prefix}: ${parsed.length} codes with at least one Tamiya equivalent`);
  rows.push(...parsed);
}

rows.sort((a, b) => a.code[0]!.localeCompare(b.code[0]!) || Number(a.code.slice(1)) - Number(b.code.slice(1)));

writeFileSync("scripts/data/mech9-gunze-tamiya.json", JSON.stringify(rows, null, 2) + "\n");
console.log(
  `Wrote scripts/data/mech9-gunze-tamiya.json — ${rows.length} codes, ` +
    `${rows.reduce((n, r) => n + r.tamiya.length, 0)} (code, Tamiya) pairs.`,
);
