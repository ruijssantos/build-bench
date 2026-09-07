import { readFileSync } from "node:fs";

import { deltaE2000, type Lab } from "../src/catalogue/colour-match";
import { resolveForeignCode } from "../src/catalogue/equivalents";
import { normalizeExtractedPaints } from "../src/domain/kit-paint-extraction";

/**
 * CI gate — docs/PLAN.md §2.2. Fails the build if any paint code the app
 * actually needs is missing from seed/paints.tamiya.json, and reports
 * numbering gaps per line for a human to sanity-check.
 *
 * "Codes the app needs" today means: every code in the owner's real
 * inventory (§2.1 — the exact list that exposed the XF-83/XF-84 bug in the
 * prototype this catalogue replaces) and every `family` a paint references
 * must have a matching `ratio_rule`. Phase 4 will extend this to
 * `kit_paint_requirement` once that table has real rows — there's nothing to
 * check there yet.
 *
 * The inventory codes are read from `seed/inventory.initial.json` (Phase 2)
 * rather than repeated here: that file is now what the `inventory_item` table
 * is seeded from, so a code added to the shelf is checked against the
 * catalogue without anyone remembering to update this script too.
 */

interface CataloguePaint {
  code: string;
  line: string;
  family: string;
  discontinued: boolean;
}

interface RatioRule {
  family: string;
}

interface InventorySeed {
  paint_code: string;
}

interface PaintBrandSeed {
  key: string;
}

interface EquivalentSeed {
  brand: string;
  tamiya_code: string;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

const catalogue = loadJson<CataloguePaint[]>("seed/paints.tamiya.json");
const ratioRules = loadJson<RatioRule[]>("seed/ratio-rules.json");
const KNOWN_INVENTORY_CODES = loadJson<InventorySeed[]>("seed/inventory.initial.json").map(
  (item) => item.paint_code,
);
const paintBrands = loadJson<PaintBrandSeed[]>("seed/paint-brands.json");
const equivalents = loadJson<EquivalentSeed[]>("seed/equivalents.json");

const catalogueCodes = new Set(catalogue.map((p) => p.code));
const ratioFamilies = new Set(ratioRules.map((r) => r.family));
const brandKeys = new Set(paintBrands.map((b) => b.key));

let failed = false;

console.log(`Catalogue: ${catalogue.length} paints across ${new Set(catalogue.map((p) => p.line)).size} lines.`);

// 1. Every code the owner actually owns must be in the catalogue.
const missingInventory = KNOWN_INVENTORY_CODES.filter((code) => !catalogueCodes.has(code));
if (missingInventory.length > 0) {
  failed = true;
  console.error(
    `\n✗ ${missingInventory.length} code(s) from seed/inventory.initial.json (docs/PLAN.md §2.1) are missing from the catalogue:`,
  );
  for (const code of missingInventory) console.error(`  - ${code}`);
}

// 2. Every paint's family must resolve to a real ratio_rule (paint.family FK).
const badFamily = catalogue.filter((p) => !ratioFamilies.has(p.family));
if (badFamily.length > 0) {
  failed = true;
  console.error(`\n✗ ${badFamily.length} paint(s) reference a family with no ratio_rule:`);
  for (const p of badFamily.slice(0, 20)) console.error(`  - ${p.code} → "${p.family}"`);
}

// 3. Every equivalent's Tamiya code must be a real catalogue code, and its
// brand a real paint_brand — the same FK constraints Postgres would enforce
// at seed time, checked here so a bad build-equivalents.ts run fails CI
// instead of failing `npm run db:seed` on someone's machine.
const badEquivalentCodes = equivalents.filter((e) => !catalogueCodes.has(e.tamiya_code));
if (badEquivalentCodes.length > 0) {
  failed = true;
  console.error(`\n✗ ${badEquivalentCodes.length} equivalent(s) reference a Tamiya code not in the catalogue:`);
  for (const e of badEquivalentCodes.slice(0, 20)) console.error(`  - ${e.tamiya_code}`);
}
const badEquivalentBrands = equivalents.filter((e) => !brandKeys.has(e.brand));
if (badEquivalentBrands.length > 0) {
  failed = true;
  console.error(`\n✗ ${badEquivalentBrands.length} equivalent(s) reference a brand not in seed/paint-brands.json:`);
  for (const e of badEquivalentBrands.slice(0, 20)) console.error(`  - ${e.brand}`);
}

// 4. A foreign code must still resolve when written the way it is *printed*.
// The chart stores Gunze's codes zero-padded to three digits ("H004"); no
// bottle, box or manual writes them that way, and a Japanese kit's paint
// table says "H4". That mismatch made `resolveForeignCode` miss every Gunze
// callout in the app's first real extraction while every row above passed —
// the FK checks confirm the chart is internally consistent, which says
// nothing about whether it can be looked up. Both directions are the point,
// so the lookup gets a gate of its own.
//
// The expected Tamiya code is asserted too, not just "something resolved":
// the same extraction returned LP codes for a shelf stocked entirely in
// X/XF, which is a wrong answer rather than a missing one, and the sort of
// thing a bare truthiness check waves through.
// The eight resolvable callouts from the Fujimi Ferrari 330 P4 (§7) — the
// first manual this app ever extracted, and the one that exposed both faults.
// Every expected code here is a paint on the real shelf (§2.1), so a data
// change that quietly re-points one of them turns "you own this" into "go and
// buy this", which is the failure mode worth a permanent guard.
const PRINTED_CODE_CASES: Array<[foreign: string, tamiya: string]> = [
  ["H4", "X-8"], // Gunze Aqueous, as a Fujimi table prints it
  ["H8", "X-11"],
  ["H9", "X-12"],
  ["H11", "XF-2"],
  ["H12", "XF-1"],
  ["H40", "X-21"],
  ["H90", "X-27"],
  ["H92", "X-26"],
  ["C1", "X-2"], // and via the Mr. Color number printed beside it
  ["C004", "X-8"], // a padded code still has to resolve — both forms work
];
const unresolvable = PRINTED_CODE_CASES.filter(
  ([foreign, tamiya]) => resolveForeignCode(foreign) !== tamiya,
);
if (unresolvable.length > 0) {
  failed = true;
  console.error(`\n✗ ${unresolvable.length} foreign code(s) no longer resolve as expected:`);
  for (const [foreign, tamiya] of unresolvable) {
    console.error(`  - ${foreign} → ${resolveForeignCode(foreign) ?? "null"}, expected ${tamiya}`);
  }
}

// 5. Resolution must survive extraction returning no `codeGuess`.
//
// Checks 1-4 all test the *data*. This one tests the path that reads it, and
// it exists because that path had a single point of failure the data checks
// could never see: `resolveCode` only ever asked the chart about the model's
// separate `codeGuess` field. One extraction returned clean labels and no
// `codeGuess`, and every callout on a Japanese kit came back unresolved with
// the chart sitting right there holding the answers.
//
// So the labels below are run through the real `normalizeExtractedPaints`
// with `codeGuess` omitted entirely — the exact shape of that run.
const NO_GUESS_CASES: Array<[rawLabel: string, expected: string | null]> = [
  ["H4 イエロー YELLOW", "X-8"],
  ["H8 シルバー SILVER", "X-11"],
  ["H12 つや消し黒 FLAT BLACK", "XF-1"],
  ["H38 赤鉄色 STEEL RED", "X-10"],
  ["H86 モンザレッド RED MADDER", null], // no Tamiya equivalent in either chart
  ["X-11 CHROME SILVER", "X-11"], // a Tamiya callout still resolves as itself
  ["13. Chrome Silver (X-11)", "X-11"], // ...including mid-label
  ["H A = H8 + H9 (1:1)", null], // a mixing instruction is not a paint
];

const resolvedWithoutGuess = normalizeExtractedPaints({
  requirements: NO_GUESS_CASES.map(([rawLabel]) => ({ rawLabel })),
  foundPaintChart: true,
});
const guessFailures = NO_GUESS_CASES.filter(
  ([, expected], i) => (resolvedWithoutGuess[i]?.paintCode ?? null) !== expected,
);
if (guessFailures.length > 0) {
  failed = true;
  console.error(
    `\n✗ ${guessFailures.length} label(s) resolve wrongly when extraction returns no codeGuess:`,
  );
  for (const [rawLabel, expected] of guessFailures) {
    const i = NO_GUESS_CASES.findIndex(([l]) => l === rawLabel);
    console.error(
      `  - "${rawLabel}" → ${resolvedWithoutGuess[i]?.paintCode ?? "null"}, expected ${expected ?? "null"}`,
    );
  }
}

// 6. CIEDE2000 must match the published reference values.
//
// The colour-distance fallback (`src/catalogue/colour-match.ts`) is only worth
// having if the distance is right, and this formula has several places where a
// wrong answer still looks plausible — the hue average wrapping past 360°, and
// the arctangent's quadrant. Reasonable-looking output is not evidence.
//
// These are Sharma, Wu & Dalal's own test pairs, chosen to cover exactly those
// traps: the near-neutral cases where chroma collapses, and the pairs that
// straddle the hue wrap.
const CIEDE2000_CASES: Array<[Lab, Lab, number]> = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
];
const deltaEFailures = CIEDE2000_CASES.filter(
  ([a, b, expected]) => Math.abs(deltaE2000(a, b) - expected) > 0.0001,
);
if (deltaEFailures.length > 0) {
  failed = true;
  console.error(`\n✗ ${deltaEFailures.length} CIEDE2000 reference pair(s) disagree:`);
  for (const [a, b, expected] of deltaEFailures) {
    console.error(`  - ${deltaE2000(a, b).toFixed(4)}, expected ${expected}`);
  }
}

if (!failed) {
  console.log(
    "✓ Every known-inventory code is present, every paint's family resolves to a ratio rule, every " +
      `equivalent (${equivalents.length}) resolves to a real catalogue code and brand, foreign ` +
      "codes resolve as printed, labels resolve without a codeGuess, and CIEDE2000 matches its " +
      `${CIEDE2000_CASES.length} reference pairs.`,
  );
}

// 3. Report (non-failing) numbering gaps per line, for a human to sanity-check.
const NUMBERED_LINES = ["X", "XF", "LP", "TS", "AS", "PS"];
console.log("\nNumbering gaps (informational — not a failure):");
for (const line of NUMBERED_LINES) {
  const numbers = catalogue
    .filter((p) => p.line === line)
    .map((p) => Number(p.code.match(/-(\d+)/)?.[1]))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (numbers.length === 0) continue;

  const gaps: string[] = [];
  for (let i = numbers[0]; i < numbers[numbers.length - 1]; i++) {
    if (!numbers.includes(i)) gaps.push(String(i));
  }
  console.log(
    `  ${line}-${numbers[0]}..${numbers[numbers.length - 1]}: ${gaps.length === 0 ? "no gaps" : `missing ${gaps.join(", ")}`}`,
  );
}

if (failed) {
  console.error("\nverify-catalogue failed.");
  process.exit(1);
}
