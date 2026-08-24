import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Neon's HTTP driver, not node-postgres — docs/PLAN.md §4. No connection
 * pool to exhaust across serverless invocations.
 */
const sql = neon(process.env.DATABASE_URL ?? "");

export const db = drizzle(sql, { schema });
