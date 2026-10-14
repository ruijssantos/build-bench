import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Type-scale guard — docs/PLAN.md §4.1 "Type".
 *
 * The UI was built page by page, and by the time anyone looked across it there
 * were 26 different font sizes, half of them on half-pixels (10.5, 11.5, 12.5,
 * 13.5, 14.5) and some at 10px. None of that fails a build or shows in review:
 * each size looked fine in the one screen it was added for. This makes the
 * scale in `tokens.css` the only way to set a text size below display.
 *
 * Allowed: `var(--text-*)`, `inherit`, or a whole pixel size of 16 or more —
 * display roles (titles, hero numerals) and a phone input's 16px, below which
 * iOS Safari zooms the page on focus.
 */

const ROOT = "src";
const SCALE_FILE = join("src", "styles", "tokens.css");
const MIN_LITERAL_PX = 16;

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

const files = cssFiles(ROOT).filter((path) => path !== SCALE_FILE);
const failures: string[] = [];
let checked = 0;

for (const file of files) {
  readFileSync(file, "utf-8")
    .split("\n")
    .forEach((line, index) => {
      const match = /font-size:\s*([^;]+);/.exec(line);
      if (!match) return;
      checked += 1;

      const value = match[1].trim();
      if (/^var\(--text-[a-z0-9]+\)$/.test(value) || value === "inherit") return;

      const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
      if (px && Number.isInteger(Number(px[1])) && Number(px[1]) >= MIN_LITERAL_PX) return;

      failures.push(`${relative(".", file)}:${index + 1}  font-size: ${value}`);
    });
}

if (failures.length > 0) {
  console.error(`Off-scale font sizes (${failures.length}):\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    `\nUse a var(--text-*) step from ${SCALE_FILE}, or a whole-pixel display size of ` +
      `${MIN_LITERAL_PX}px or more. See docs/PLAN.md §4.1.`,
  );
  process.exit(1);
}

console.log(`✓ ${checked} font sizes across ${files.length} stylesheets are on the type scale`);
