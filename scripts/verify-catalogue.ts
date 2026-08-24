import { readFileSync } from "node:fs";

/**
 * CI gate — docs/PLAN.md §2.2. Fails the build if any paint code the app
 * actually needs is missing from seed/paints.tamiya.json, and reports
 * numbering gaps per line for a human to sanity-check.
 *
 * "Codes the app needs" today means: every code in the owner's real
 * inventory (§2.1 — the exact list that exposed the XF-83/XF-84 bug in the
 * prototype this catalogue replaces) and every `family` a paint references
 * must have a matching `ratio_rule`. Phases 3/4 will extend this to also
 * check `inventory_item` and `kit_paint_requirement` once those tables have
 * real rows — there's nothing to check there yet.
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

// docs/PLAN.md §2.1 — the owner's real inventory as imported from the Google
// Sheet. This is the exact list that would have caught XF-83/XF-84 being
// missing from the prototype's paint library before it shipped.
const KNOWN_INVENTORY_CODES = [
  "X-2", "X-3", "X-6", "X-7", "X-8", "X-9", "X-10", "X-11", "X-12", "X-13",
  "X-14", "X-18", "X-19", "X-21", "X-22", "X-24", "X-26", "X-27",
  "XF-1", "XF-2", "XF-7", "XF-16", "XF-24", "XF-53", "XF-56", "XF-60",
  "XF-64", "XF-83", "XF-84",
  "TS-7", "TS-8",
  "PRIMER-LIQUID-GREY", "PRIMER-LIQUID-WHITE",
];

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

const catalogue = loadJson<CataloguePaint[]>("seed/paints.tamiya.json");
const ratioRules = loadJson<RatioRule[]>("seed/ratio-rules.json");

const catalogueCodes = new Set(catalogue.map((p) => p.code));
const ratioFamilies = new Set(ratioRules.map((r) => r.family));

let failed = false;

console.log(`Catalogue: ${catalogue.length} paints across ${new Set(catalogue.map((p) => p.line)).size} lines.`);

// 1. Every code the owner actually owns must be in the catalogue.
const missingInventory = KNOWN_INVENTORY_CODES.filter((code) => !catalogueCodes.has(code));
if (missingInventory.length > 0) {
  failed = true;
  console.error(
    `\n✗ ${missingInventory.length} code(s) from the real inventory (docs/PLAN.md §2.1) are missing from the catalogue:`,
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

if (!failed) {
  console.log("✓ Every known-inventory code is present, and every paint's family resolves to a ratio rule.");
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
