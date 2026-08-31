import { readFileSync } from "node:fs";

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

if (!failed) {
  console.log(
    "✓ Every known-inventory code is present, every paint's family resolves to a ratio rule, and every " +
      `equivalent (${equivalents.length}) resolves to a real catalogue code and brand.`,
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
