import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { ratioOverride } from "@/db/schema";

export type RatioOverrideRow = typeof ratioOverride.$inferSelect;

/** The most recent correction for this exact paint code, if any. */
export async function getOverrideForPaint(code: string): Promise<RatioOverrideRow | undefined> {
  const rows = await db
    .select()
    .from(ratioOverride)
    .where(eq(ratioOverride.paintCode, code))
    .orderBy(desc(ratioOverride.createdAt))
    .limit(1);
  return rows[0];
}

export interface CreateOverrideInput {
  paintCode: string;
  paintParts: number;
  thinnerParts: number;
  psiText?: string | null;
  reason?: string | null;
}

export async function createOverride(input: CreateOverrideInput): Promise<RatioOverrideRow> {
  const rows = await db
    .insert(ratioOverride)
    .values({
      paintCode: input.paintCode,
      paintParts: input.paintParts,
      thinnerParts: input.thinnerParts,
      psiText: input.psiText ?? null,
      reason: input.reason ?? null,
    })
    .returning();
  return rows[0];
}
