import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Neon's HTTP driver, not node-postgres — docs/PLAN.md §4. No connection
 * pool to exhaust across serverless invocations.
 *
 * Built lazily behind a Proxy: `next build` imports every route module to
 * collect its static config, which evaluates this file even for routes that
 * are never invoked. Constructing the client eagerly (`neon(DATABASE_URL)`)
 * throws immediately on an empty string, and CI's build has no real
 * DATABASE_URL — Phase 0 never hit this because no route touched the DB.
 * Deferring construction to first actual use keeps the import side-effect
 * free; a route that really queries the DB without DATABASE_URL set still
 * fails, just at request time instead of at build time.
 */
let cached: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!cached) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set.");
    }
    cached = drizzle(neon(databaseUrl), { schema });
  }
  return cached;
}

export const db: NeonHttpDatabase<typeof schema> = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
