import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Turns mech9's Gunze *colour chart* pages into `seed/gunze-colours.json` —
 * one sRGB hex per Gunze code (docs/PLAN.md §2.2).
 *
 * Usage — one PDF per GSI line, printed to PDF from mech9.com:
 *
 *   npx tsx scripts/parse-mech9-swatches.mts H aqueous-chart.pdf \
 *                                            C mr-color-chart.pdf
 *
 * Needs `pdftotext` and `qpdf` (poppler-utils, qpdf).
 *
 * ## Why this is exact rather than sampled
 *
 * The obvious approach — render the page and read the middle pixel of each
 * swatch — would be approximate, and would inherit whatever the rasteriser
 * did about anti-aliasing and colour management. It isn't necessary: the
 * chart is an HTML table whose cells carry a background colour, so the
 * swatches survive into the PDF as *vector fills*. `pdfimages` finds only 32
 * images on a page of ~200 swatches, and every one of those is page
 * furniture. So the colour is read straight out of the content stream, which
 * is the number the page was authored with.
 *
 * The stream draws each swatch as a closed four-point path (`m`/`l`/`h`/`f`)
 * under an `sc` fill colour. `re` appears too but only as a clip path
 * (`re W n`), which is why the interpreter below has to honour `W` and paint
 * nothing for it.
 *
 * ## Associating a swatch with its code
 *
 * The swatch *is* the table cell's background, and the code is drawn on top
 * of it, so a label belongs to the fill that contains it. No nearest-neighbour
 * guessing, and it lands 183/183 and 233/233 with nothing missed — which is
 * the check worth keeping an eye on if a re-export ever changes the layout.
 *
 * pdftotext measures y downwards from the top of the page and the content
 * stream measures it upwards from the bottom, hence the flip.
 *
 * ## What the number is, and is not
 *
 * A screen swatch is how a chart chose to depict a paint, not a measurement
 * of the paint. It is the right input for "which Tamiya paint is nearest",
 * and the wrong input for any claim stronger than that.
 */

interface Word {
  x: number;
  y: number;
  x2: number;
  y2: number;
  text: string;
}

interface Fill {
  x: number;
  y: number;
  w: number;
  h: number;
  rgb: [number, number, number];
}

type Matrix = [number, number, number, number, number, number];

const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** Every filled shape in the page's content streams, in page coordinates. */
function filledShapes(pdfPath: string): Fill[] {
  const out = join(mkdtempSync(join(tmpdir(), "mech9-")), "qdf.pdf");
  // qpdf exits 3 on "succeeded with warnings", which these captures always
  // produce; only a hard failure should stop us.
  try {
    execFileSync("qpdf", ["--qdf", "--object-streams=disable", pdfPath, out], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 3) throw error;
  }

  const raw = readFileSync(out, "latin1");
  const fills: Fill[] = [];

  // qdf labels each page's content stream, which keeps image bytes out.
  for (const marker of raw.matchAll(/%% Contents for page \d+/g)) {
    const start = raw.indexOf("stream\n", marker.index);
    const end = raw.indexOf("\nendstream", start);
    if (start < 0 || end < start) continue;

    let ctm: Matrix = [1, 0, 0, 1, 0, 0];
    let colour: [number, number, number] = [0, 0, 0];
    const stack: Array<{ ctm: Matrix; colour: [number, number, number] }> = [];
    const operands: number[] = [];
    let path: Array<[number, number]> = [];
    let clipPending = false;

    for (const token of raw.slice(start + 7, end).split(/\s+/)) {
      if (/^-?[\d.]+$/.test(token)) {
        operands.push(Number(token));
        continue;
      }
      switch (token) {
        case "q":
          stack.push({ ctm: [...ctm] as Matrix, colour: [...colour] as [number, number, number] });
          break;
        case "Q": {
          const saved = stack.pop();
          if (saved) ({ ctm, colour } = saved);
          break;
        }
        case "cm":
          if (operands.length >= 6) ctm = multiply(operands.slice(-6) as Matrix, ctm);
          break;
        case "sc":
        case "scn":
        case "rg":
          if (operands.length >= 3) colour = operands.slice(-3) as [number, number, number];
          else if (operands.length === 1) colour = [operands[0]!, operands[0]!, operands[0]!];
          break;
        case "g":
          if (operands.length >= 1) {
            const v = operands.at(-1)!;
            colour = [v, v, v];
          }
          break;
        case "m":
        case "l":
          if (operands.length >= 2) path.push(apply(ctm, operands.at(-2)!, operands.at(-1)!));
          break;
        case "re":
          if (operands.length >= 4) {
            const [x, y, w, h] = operands.slice(-4) as [number, number, number, number];
            for (const [px, py] of [
              [x, y],
              [x + w, y],
              [x + w, y + h],
              [x, y + h],
            ] as Array<[number, number]>) {
              path.push(apply(ctm, px, py));
            }
          }
          break;
        case "W":
        case "W*":
          clipPending = true;
          break;
        case "n":
        case "S":
        case "s":
          path = [];
          clipPending = false;
          break;
        case "f":
        case "F":
        case "f*":
        case "b":
        case "b*":
        case "B":
        case "B*": {
          if (path.length >= 3 && !clipPending) {
            const xs = path.map((p) => p[0]);
            const ys = path.map((p) => p[1]);
            fills.push({
              x: Math.min(...xs),
              y: Math.min(...ys),
              w: Math.max(...xs) - Math.min(...xs),
              h: Math.max(...ys) - Math.min(...ys),
              rgb: colour.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255)) as [
                number,
                number,
                number,
              ],
            });
          }
          path = [];
          clipPending = false;
          break;
        }
        default:
          break;
      }
      operands.length = 0;
    }
  }
  return fills;
}

function words(pdfPath: string): { words: Word[]; pageHeight: number } {
  const out = join(mkdtempSync(join(tmpdir(), "mech9-")), "page.xml");
  execFileSync("pdftotext", ["-bbox-layout", pdfPath, out], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  const xml = readFileSync(out, "utf-8");
  const height = Number(/<page width="[\d.]+" height="([\d.]+)"/.exec(xml)?.[1] ?? 0);
  const list: Word[] = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  for (const m of xml.matchAll(re)) {
    list.push({
      x: Number(m[1]),
      y: Number(m[2]),
      x2: Number(m[3]),
      y2: Number(m[4]),
      text: m[5]!,
    });
  }
  return { words: list, pageHeight: height };
}

function parse(pdfPath: string, prefix: string): Array<{ code: string; hex: string }> {
  const { words: pageWords, pageHeight } = words(pdfPath);
  // Swatch cells are a fixed ~90pt wide; their height varies with the text
  // inside. Everything else at that width is a 1pt table rule.
  const swatches = filledShapes(pdfPath).filter((f) => f.w >= 80 && f.w <= 100 && f.h >= 40);

  const labelRe = new RegExp(`^\\(${prefix}(\\d{1,3})\\)$`);
  const out: Array<{ code: string; hex: string }> = [];
  const missed: string[] = [];

  for (const word of pageWords) {
    const m = labelRe.exec(word.text);
    if (!m) continue;
    const cx = (word.x + word.x2) / 2;
    const cy = pageHeight - (word.y + word.y2) / 2;
    const hit = swatches.find(
      (f) => cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h,
    );
    const code = `${prefix}${m[1]}`;
    if (hit) {
      out.push({
        code,
        hex: "#" + hit.rgb.map((v) => v.toString(16).padStart(2, "0")).join(""),
      });
    } else {
      missed.push(code);
    }
  }

  console.log(
    `${prefix}: ${out.length} swatches matched` +
      (missed.length ? `, ${missed.length} MISSED (${missed.slice(0, 10).join(",")})` : ", none missed"),
  );
  return out.sort((a, b) => Number(a.code.slice(1)) - Number(b.code.slice(1)));
}

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
  console.error("Usage: tsx scripts/parse-mech9-swatches.mts <H|C> <pdf> [<H|C> <pdf> ...]");
  process.exit(1);
}

const rows: Array<{ code: string; hex: string }> = [];
for (let i = 0; i < args.length; i += 2) {
  rows.push(...parse(args[i + 1]!, args[i]!.toUpperCase()));
}
rows.sort(
  (a, b) => a.code[0]!.localeCompare(b.code[0]!) || Number(a.code.slice(1)) - Number(b.code.slice(1)),
);

writeFileSync("seed/gunze-colours.json", JSON.stringify(rows, null, 2) + "\n");
console.log(`Wrote seed/gunze-colours.json — ${rows.length} colours.`);
