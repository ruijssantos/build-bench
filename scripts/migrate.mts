import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { loadLocalEnv } from "./load-env.mts";

// .mts, not .ts: this uses top-level await, which CommonJS can't represent.
// package.json has no "type": "module", so tsx compiles a plain .ts file to
// CJS by default — the .mts extension forces it to run as a real ES module.

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const db = drizzle(sql);

/**
 * Neon's HTTP driver doesn't support transactions, so a migration that fails
 * partway through isn't rolled back automatically.
 *
 * Worse, drizzle's migrator writes its bookkeeping rows only after *every*
 * pending migration has run, so one failure leaves nothing recorded — even
 * the migrations that succeeded moments earlier in the same invocation. The
 * next run therefore replays them from the top, against a database that has
 * already had half of them applied.
 *
 * **So every migration in ./drizzle must be replay-safe**: `IF EXISTS` /
 * `IF NOT EXISTS` on every drop, add and create, and an explicit `USING` on
 * a type change so it's a no-op the second time. 0002 learned this the hard
 * way — it dropped `vendor` with CASCADE (which takes the foreign keys
 * pointing at it with it) and then tried to drop those same constraints by
 * name, which fails on a first run and a replay alike.
 *
 * Editing an existing migration to make it replay-safe is safe: the migrator
 * picks what to run purely by the journal's timestamp and never compares the
 * `hash` it stored, so a database that already recorded a migration will not
 * re-run it whatever the file now says.
 */
await migrate(db, { migrationsFolder: "./drizzle" });

console.log("Migrations applied.");
