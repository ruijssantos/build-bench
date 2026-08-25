import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

/**
 * Performance budget — docs/PERFORMANCE.md.
 *
 * Runs against a finished `next build`, in CI, right after it. It exists
 * because every regression this guards against is invisible in review: a
 * `"use client"` added one level too high, a static import of the catalogue,
 * a page that quietly stops being prerenderable. All three cost real
 * milliseconds and none of them show up as a failing test.
 *
 * When a budget legitimately needs to move, move it in the same commit as the
 * change that needs it, and say why in the message.
 */

const BUILD_DIR = ".next";

const BUDGETS = {
  /** Scripts the browser must have before the Thinner Bench is interactive,
   * gzipped. Framework included — it's what the user actually downloads. */
  initialJsGzip: 150 * 1024,
  /** The prerendered static shell for the busiest screen, gzipped — what a
   * CDN hands over before anything streams. */
  documentGzip: 8 * 1024,
  /** Stylesheets are cached across navigations, so this can be generous —
   * but not unbounded. */
  cssGzip: 8 * 1024,
};

interface Failure {
  what: string;
  actual: string;
  budget: string;
}

const failures: Failure[] = [];
const notes: string[] = [];

function gzipOf(path: string): number {
  return gzipSync(readFileSync(path)).length;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function check(what: string, actual: number, budget: number): void {
  const line = `${what}: ${kb(actual)} (budget ${kb(budget)})`;
  if (actual > budget) failures.push({ what, actual: kb(actual), budget: kb(budget) });
  notes.push(`${actual > budget ? "✗" : "✓"} ${line}`);
}

function readHtml(route: string): string {
  return readFileSync(join(BUILD_DIR, "server/app", `${route}.html`), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. What the browser downloads for the Thinner Bench
// ---------------------------------------------------------------------------

const html = readHtml("thinner");
const chunkDir = join(BUILD_DIR, "static/chunks");

/** Every <script> the document pulls in, minus the `noModule` legacy bundle,
 * which no module-capable browser ever fetches. */
const eagerScripts = [...html.matchAll(/<script src="\/_next\/(static\/chunks\/[^"]+\.js)"([^>]*)>/g)]
  .filter((m) => !m[2].includes("noModule"))
  .map((m) => m[1]);

if (eagerScripts.length === 0) {
  throw new Error("Found no scripts in the prerendered /thinner document — has the build layout changed?");
}

const initialJs = eagerScripts.reduce((total, src) => total + gzipOf(join(BUILD_DIR, src)), 0);
check("initial JS (gzip)", initialJs, BUDGETS.initialJsGzip);

check("/thinner document (gzip)", gzipSync(Buffer.from(html)).length, BUDGETS.documentGzip);

const cssTotal = [...html.matchAll(/href="\/_next\/(static\/chunks\/[^"]+\.css)"/g)].reduce(
  (total, m) => total + gzipOf(join(BUILD_DIR, m[1])),
  0,
);
check("/thinner CSS (gzip)", cssTotal, BUDGETS.cssGzip);

// ---------------------------------------------------------------------------
// 2. The paint catalogue must stay in a lazily-loaded chunk
// ---------------------------------------------------------------------------

/** A string that only exists in the catalogue, so its presence in a chunk
 * means the whole catalogue is in that chunk. */
const CATALOGUE_MARKER = "Italian Red";

const eagerNames = new Set(eagerScripts.map((src) => src.split("/").pop()));
const leaked = readdirSync(chunkDir)
  .filter((name) => name.endsWith(".js") && eagerNames.has(name))
  .filter((name) => readFileSync(join(chunkDir, name), "utf-8").includes(CATALOGUE_MARKER));

if (leaked.length > 0) {
  failures.push({
    what: "paint catalogue is in an eagerly-loaded chunk",
    actual: leaked.join(", "),
    budget: "lazy chunk only",
  });
} else {
  notes.push("✓ paint catalogue stays behind its dynamic import");
}

// ---------------------------------------------------------------------------
// 3. Every route keeps a static shell
// ---------------------------------------------------------------------------

const appDir = join(BUILD_DIR, "server/app");
const prerendered = readdirSync(appDir).filter((f) => f.endsWith(".html"));

const ROUTES_THAT_MUST_PRERENDER = ["thinner", "inventory", "kits", "wishlist", "log", "login"];

for (const route of ROUTES_THAT_MUST_PRERENDER) {
  if (!prerendered.includes(`${route}.html`)) {
    failures.push({
      what: `/${route} has no prerendered shell`,
      actual: "server-rendered on demand",
      budget: "static or partially prerendered",
    });
  }
}
if (failures.every((f) => !f.what.includes("prerendered shell"))) {
  notes.push(`✓ all ${ROUTES_THAT_MUST_PRERENDER.length} app routes ship a static shell`);
}

// ---------------------------------------------------------------------------

console.log(notes.join("\n"));

if (failures.length > 0) {
  console.error("\nPerformance budget exceeded:\n");
  for (const f of failures) {
    console.error(`  ${f.what}\n    is:     ${f.actual}\n    budget: ${f.budget}\n`);
  }
  console.error("See docs/PERFORMANCE.md. Move a budget only alongside the change that needs it.");
  process.exit(1);
}

console.log("\nWithin budget.");
