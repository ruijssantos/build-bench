import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { ratioRule } from "@/db/schema";

export type RatioRuleRow = typeof ratioRule.$inferSelect;

export async function getRatioRule(family: string): Promise<RatioRuleRow | undefined> {
  const rows = await db.select().from(ratioRule).where(eq(ratioRule.family, family)).limit(1);
  return rows[0];
}
