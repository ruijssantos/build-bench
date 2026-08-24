import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { airbrush } from "@/db/schema";

export type AirbrushRow = typeof airbrush.$inferSelect;

export const AIRBRUSH_TAG = "airbrush";

/**
 * The single active rig — §2.3: every rig fact in the UI reads from this row.
 *
 * Two layers, and both matter:
 *
 * `connection()` pins the read to request time, so `next build` prerenders the
 * shell without ever opening a connection — CI has no DATABASE_URL, and a
 * database the build depends on is a build that breaks when the database does.
 * Callers must therefore sit inside a <Suspense> boundary.
 *
 * `use cache` then means the query itself runs about as often as the rig
 * actually changes, rather than once per screen per visit.
 */
export async function getActiveAirbrush(): Promise<AirbrushRow | undefined> {
  await connection();
  return queryActiveAirbrush();
}

async function queryActiveAirbrush(): Promise<AirbrushRow | undefined> {
  "use cache";
  cacheLife("rig");
  cacheTag(AIRBRUSH_TAG);

  const rows = await db.select().from(airbrush).where(eq(airbrush.isActive, true)).limit(1);
  return rows[0];
}
