import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { airbrush } from "@/db/schema";

export type AirbrushRow = typeof airbrush.$inferSelect;

/** The single active rig — §2.3: every rig fact in the UI reads from this row. */
export async function getActiveAirbrush(): Promise<AirbrushRow | undefined> {
  const rows = await db.select().from(airbrush).where(eq(airbrush.isActive, true)).limit(1);
  return rows[0];
}
