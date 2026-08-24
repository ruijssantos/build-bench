import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// .mts, not .ts: this uses top-level await, which CommonJS can't represent.
// package.json has no "type": "module", so tsx compiles a plain .ts file to
// CJS by default — the .mts extension forces it to run as a real ES module.

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const db = drizzle(sql);

// Neon's HTTP driver doesn't support transactions, so a migration that fails
// partway through isn't rolled back automatically — check the error and the
// database state by hand if this ever fails mid-run.
await migrate(db, { migrationsFolder: "./drizzle" });

console.log("Migrations applied.");
