import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { ratioOverride } from "@/db/schema";

export type RatioOverrideRow = typeof ratioOverride.$inferSelect;

/** One tag per paint code, so saving a correction for XF-64 doesn't evict TS-8's. */
export function overrideTag(paintCode: string): string {
  return `ratio-override:${paintCode}`;
}

/**
 * The most recent correction for this exact paint code, if any.
 *
 * `connection()` then `use cache`: request-time only, so `next build` never
 * opens a database (CI has no DATABASE_URL), and cached, so a screen that has
 * already been looked at costs nothing to look at again. Callers must sit
 * inside a <Suspense> boundary.
 */
export async function getOverrideForPaint(code: string): Promise<RatioOverrideRow | undefined> {
  await connection();
  return queryOverrideForPaint(code);
}

async function queryOverrideForPaint(code: string): Promise<RatioOverrideRow | undefined> {
  "use cache";
  cacheLife("bench");
  cacheTag(overrideTag(code));

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
