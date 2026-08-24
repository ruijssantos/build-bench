import { readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { airbrush, paint, ratioRule } from "../src/db/schema";

/**
 * Loads seed/paints.tamiya.json and seed/ratio-rules.json into `paint` and
 * `ratio_rule` — docs/PLAN.md §9.3. Also seeds the single `airbrush` row
 * (the Tamiya 74540 HG Trigger, §2.3): the Thinner Bench reads every rig
 * fact from that row rather than hard-coding it, so without a row here the
 * screen has nothing to read. Safe to re-run — paints and ratio rules
 * upsert by their natural key; the airbrush row is only inserted if none
 * exists yet.
 */

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

async function seedAirbrush() {
  const existing = await db.select().from(airbrush).where(eq(airbrush.isActive, true)).limit(1);
  if (existing.length > 0) {
    console.log("Airbrush row already exists — left as-is.");
    return;
  }
  await db.insert(airbrush).values({
    model: "Tamiya 74540 HG Trigger",
    nozzleMm: 0.3,
    cupCc: 7,
    isActive: true,
  });
  console.log("Seeded the 74540 airbrush row.");
}

await seedRatioRules();
await seedPaints();
await seedAirbrush();

console.log("Seed complete.");
