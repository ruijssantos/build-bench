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
   * but not unbounded. Raised from 8.0 kB alongside Phase 3 (Wishlist):
   * search UI, bigger result cards and the manual-entry/photo-upload dialog
   * pushed the shared `(bench)` stylesheet to ~8.0 kB. Raised again, to 9.0 kB,
   * for the sticky mobile tab bar and its sixth sign-out tab — global chrome
   * every screen shares, not a phase-specific cost, and it left the previous
   * ceiling with room for about one more CSS rule. Raised a third time, to
   * 10.0 kB, for Phase 4a (the Stash): the app's first detail route, with
   * genuinely new UI vocabulary throughout it (a status stepper, manual rows
   * with an inline PDF viewer, three paint buckets, a two-column desktop
   * layout) that nothing already on the shelf could fully cover. This is the
   * phase PLAN.md §10 named as the one that might need to split the `(bench)`
   * route group's shared stylesheet instead of raising this number again —
   * a real split was judged the worse trade for now (every bench screen
   * currently shares one cached stylesheet; splitting means a first
   * navigation into the Stash costs its own fetch), so the number moved
   * instead, deliberately, not silently. See docs/PERFORMANCE.md §10.
   * Nudged to 10.5 kB for the round of preview polish after Phase 4a shipped:
   * a bordered Edit button to match Delete, a pointer cursor on the manual
   * label pills, and a touch more spacing in the upload dropzone — all in
   * the shared `Inventory`/`InventoryForm` stylesheets `/thinner` also
   * loads, so a few real lines there cost this budget even though none of
   * them touch Thinner's own UI.
   *
   * 11.0 kB for Phase 6's Dashboard — the smallest of the four raises,
   * +0.2 kB for a whole new screen, because `Dashboard.module.css` imports
   * the wishlist's row and card vocabulary instead of restating it and only
   * declares what the screen genuinely adds (stat tiles, its two-column
   * split, three modifiers). The first draft, which restated them, cost
   * more than this whole phase did. */
  cssGzip: 11.0 * 1024,
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

const ROUTES_THAT_MUST_PRERENDER = ["dashboard", "thinner", "inventory", "kits", "wishlist", "login"];

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
