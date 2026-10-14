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
 * The size ceilings are loose on purpose (the owner's call): this is an
 * internal tool, and the aim is good Core Web Vitals as practice, not a
 * byte-count contest. They sit well above today's numbers and exist to catch
 * a *step* change, such as a dependency pulled into the eager bundle or a whole
 * stylesheet duplicated, not to make every feature fight for bytes. When
 * one is hit, raise it and note why in docs/PERFORMANCE.md §11. The
 * structural checks below (catalogue behind its import, a static shell on
 * every route) are the ones that actually protect load speed, and those stay
 * strict.
 */

const BUILD_DIR = ".next";

const BUDGETS = {
  /** Scripts the browser must have before the Thinner Bench is interactive,
   * gzipped. Framework included — it's what the user actually downloads. */
  initialJsGzip: 200 * 1024,
  /** The prerendered static shell for the busiest screen, gzipped — what a
   * CDN hands over before anything streams. */
  documentGzip: 8 * 1024,
  /** Every bench screen shares one cached stylesheet, so this is paid once
   * per visit, not per navigation. The history of how it grew is in
   * docs/PERFORMANCE.md §11. */
  cssGzip: 20 * 1024,
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
// 1. What the browser downloads for the busiest screens
//
// Both routes here, not just Thinner: the Wishlist regression that started
// this section of the budget (a 220px skeleton where a populated grid could
// run 1,000px+, and box art shipped unresized to Vercel Blob) shipped clean
// through this script because it only ever looked at /thinner. A screen this
// budget doesn't check is a screen with no budget.
// ---------------------------------------------------------------------------

const BUDGETED_ROUTES = ["thinner", "wishlist"];
const chunkDir = join(BUILD_DIR, "static/chunks");
let eagerScripts: string[] = [];

for (const route of BUDGETED_ROUTES) {
  const html = readHtml(route);

  /** Every <script> the document pulls in, minus the `noModule` legacy
   * bundle, which no module-capable browser ever fetches. */
  const scripts = [...html.matchAll(/<script src="\/_next\/(static\/chunks\/[^"]+\.js)"([^>]*)>/g)]
    .filter((m) => !m[2].includes("noModule"))
    .map((m) => m[1]);

  if (scripts.length === 0) {
    throw new Error(`Found no scripts in the prerendered /${route} document — has the build layout changed?`);
  }
  if (route === "thinner") eagerScripts = scripts; // reused by section 2, below

  const initialJs = scripts.reduce((total, src) => total + gzipOf(join(BUILD_DIR, src)), 0);
  check(`/${route} initial JS (gzip)`, initialJs, BUDGETS.initialJsGzip);

  check(`/${route} document (gzip)`, gzipSync(Buffer.from(html)).length, BUDGETS.documentGzip);

  const cssTotal = [...html.matchAll(/href="\/_next\/(static\/chunks\/[^"]+\.css)"/g)].reduce(
    (total, m) => total + gzipOf(join(BUILD_DIR, m[1])),
    0,
  );
  check(`/${route} CSS (gzip)`, cssTotal, BUDGETS.cssGzip);
}

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
// 3. A saved kit's box art goes through Next's image optimizer
//
// The report this section responds to: 426 KiB across four unresized JPEGs,
// served verbatim because `saveBoxArt` copies the source bytes into Blob as-
// is (docs/PLAN.md §2.4 — deliberate, that's the SSRF-safe re-hosting step,
// not a resize). `KitArt` routes a saved kit's own-Blob art through
// `next/image` instead of a plain `<img>` (docs/PERFORMANCE.md, Wishlist
// section); this checks the config that makes that possible actually shipped,
// rather than the runtime behaviour, which needs a real Blob store to see.
// ---------------------------------------------------------------------------

const requiredServerFiles = JSON.parse(readFileSync(join(BUILD_DIR, "required-server-files.json"), "utf-8")) as {
  config?: { images?: { remotePatterns?: Array<{ hostname?: string }> } };
};
const blobPatternConfigured = (requiredServerFiles.config?.images?.remotePatterns ?? []).some((p) =>
  p.hostname?.endsWith(".public.blob.vercel-storage.com"),
);

if (!blobPatternConfigured) {
  failures.push({
    what: "images.remotePatterns is missing the Blob store host",
    actual: "not configured",
    budget: "next/image can optimise a saved kit's box art",
  });
} else {
  notes.push("✓ next/image is configured for the Blob store's box art");
}

// ---------------------------------------------------------------------------
// 4. Every route keeps a static shell
// ---------------------------------------------------------------------------

const appDir = join(BUILD_DIR, "server/app");
const prerendered = readdirSync(appDir).filter((f) => f.endsWith(".html"));

const ROUTES_THAT_MUST_PRERENDER = ["dashboard", "thinner", "inventory", "kits", "wishlist", "guides", "login"];

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
