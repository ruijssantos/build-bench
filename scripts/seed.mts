import { readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { inventoryItem, paint, ratioRule } from "../src/db/schema";
import { loadLocalEnv } from "./load-env.mts";

/**
 * Loads seed/paints.tamiya.json and seed/ratio-rules.json into `paint` and
 * `ratio_rule`, and seed/paint-brands.json + seed/equivalents.json into
 * `paint_brand` and `paint_equivalent` (Phase 5, docs/PLAN.md §2.2) —
 * docs/PLAN.md §9.3. Safe to re-run: `paint`/`ratio_rule`/`paint_brand`
 * upsert by their natural key; `paint_equivalent` has no natural key of its
 * own (a serial `id`, not a unique constraint on the triple it's really
 * keyed by), so re-running instead deletes and reinserts every row this
 * script itself owns.
 *
 * The rig (§2.3) is not seeded here. It lives in `seed/rig.json` and is
 * compiled into the build by `src/catalogue/rig.ts` — it was a row once, and
 * that row cost a query on every screen to return three fields that never
 * changed.
 *
 * The paint shelf is imported here too rather than from a second script:
 * `inventory_item.paint_code` is a foreign key into `paint`, so it has to run
 * after the catalogue anyway, and a separate entry point would have duplicated
 * the connection, the env loading and the "safe to re-run" rule to enforce an
 * ordering this file gets for free.
 *
 * .mts, not .ts: this uses top-level await, which CommonJS can't represent.
 * package.json has no "type": "module", so tsx compiles a plain .ts file to
 * CJS by default — the .mts extension forces it to run as a real ES module.
 */

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sqlClient = neon(databaseUrl);
const db = drizzle(sqlClient);

interface CataloguePaint {
  code: string;
  line: string;
  name: string;
  hex: string;
  family: string;
  finish: string | null;
  size_ml: number;
  discontinued: boolean;
  verified_at: string | null;
}

interface RatioRuleSeed {
  family: string;
  thinner_type: string | null;
  paint_parts: number | null;
  thinner_parts: number | null;
  window_lo: number | null;
  window_hi: number | null;
  psi_text: string | null;
  coats_text: string | null;
  distance_text: string | null;
  notes: string[];
}

interface InventorySeed {
  paint_code: string;
  form: string;
  state: string | null;
  quantity: number;
  notes: string | null;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

async function seedRatioRules() {
  const rules = loadJson<RatioRuleSeed[]>("seed/ratio-rules.json");
  for (const rule of rules) {
    await db
      .insert(ratioRule)
      .values({
        family: rule.family,
        thinnerType: rule.thinner_type,
        paintParts: rule.paint_parts,
        thinnerParts: rule.thinner_parts,
        windowLo: rule.window_lo,
        windowHi: rule.window_hi,
        psiText: rule.psi_text,
        coatsText: rule.coats_text,
        distanceText: rule.distance_text,
        notes: rule.notes,
      })
      .onConflictDoUpdate({
        target: ratioRule.family,
        set: {
          thinnerType: sql`excluded.thinner_type`,
          paintParts: sql`excluded.paint_parts`,
          thinnerParts: sql`excluded.thinner_parts`,
          windowLo: sql`excluded.window_lo`,
          windowHi: sql`excluded.window_hi`,
          psiText: sql`excluded.psi_text`,
          coatsText: sql`excluded.coats_text`,
          distanceText: sql`excluded.distance_text`,
          notes: sql`excluded.notes`,
        },
      });
  }
  console.log(`Seeded ${rules.length} ratio rules.`);
}

async function seedPaints() {
  const paints = loadJson<CataloguePaint[]>("seed/paints.tamiya.json");
  // Batched, not one row at a time — 395 rows over Neon's HTTP driver as
  // individual round trips would be slow. ratio_rule must be seeded first
  // (paint.family is a FK into it).
  const BATCH_SIZE = 50;
  for (let i = 0; i < paints.length; i += BATCH_SIZE) {
    const batch = paints.slice(i, i + BATCH_SIZE);
    await db
      .insert(paint)
      .values(
        batch.map((p) => ({
          code: p.code,
          line: p.line,
          name: p.name,
          hex: p.hex,
          family: p.family,
          finish: p.finish,
          sizeMl: p.size_ml,
          discontinued: p.discontinued,
          verifiedAt: p.verified_at ? new Date(p.verified_at) : null,
        })),
      )
      .onConflictDoUpdate({
        target: paint.code,
        set: {
          line: sql`excluded.line`,
          name: sql`excluded.name`,
          hex: sql`excluded.hex`,
          family: sql`excluded.family`,
          finish: sql`excluded.finish`,
          sizeMl: sql`excluded.size_ml`,
          discontinued: sql`excluded.discontinued`,
          verifiedAt: sql`excluded.verified_at`,
        },
      });
  }
  console.log(`Seeded ${paints.length} paints.`);
}

/**
 * The Google Sheet, imported once — docs/PLAN.md §2.1, §6 Phase 2.
 *
 * Insert-only, keyed on the paint code: `inventory_item` is *your* data from
 * the moment it lands, and re-running the seed must never undo a bottle you
 * marked low. So a code that already has a row is left completely alone, and
 * only codes missing from the shelf are added.
 *
 * `purchased_from` stays null: nothing in §2.1 carries shop data.
 */
async function seedInventory() {
  const items = loadJson<InventorySeed[]>("seed/inventory.initial.json");

  const existing = await db
    .select({ paintCode: inventoryItem.paintCode })
    .from(inventoryItem);
  const owned = new Set(existing.map((row) => row.paintCode));

  const missing = items.filter((item) => !owned.has(item.paint_code));
  if (missing.length === 0) {
    console.log(`Inventory already holds all ${items.length} seeded codes — left as-is.`);
    return;
  }

  await db.insert(inventoryItem).values(
    missing.map((item) => ({
      paintCode: item.paint_code,
      form: item.form,
      state: item.state,
      quantity: item.quantity,
      notes: item.notes,
    })),
  );
  console.log(
    `Seeded ${missing.length} inventory item(s)` +
      (missing.length === items.length ? "." : ` (${items.length - missing.length} already present).`),
  );
}

/*
 * `seedPaintBrands` and `seedPaintEquivalents` used to live here, filling
 * `paint_brand` and `paint_equivalent` from seed/paint-brands.json and
 * seed/equivalents.json. Both tables were dropped in migration 0007 — nothing
 * ever read them. `src/catalogue/equivalents.ts` imports the same two JSON
 * files directly, per the reference-data rule (docs/PLAN.md §3.1), so the
 * chart works without a database round trip and without this step. The files
 * stay; the tables and their seeding went.
 */

await seedRatioRules();
await seedPaints();
await seedInventory();

console.log("Seed complete.");
