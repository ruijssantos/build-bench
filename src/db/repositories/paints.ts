import { eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { paint } from "@/db/schema";

export type PaintRow = typeof paint.$inferSelect;

/** Type-ahead search: prefix match on code, or a substring match on the name. */
export async function searchPaints(query: string, limit = 8): Promise<PaintRow[]> {
  const q = query.trim();
  if (!q) return [];

  const compactQuery = q.replace(/[\s-]/g, "");
  return db
    .select()
    .from(paint)
    .where(
      or(
        ilike(sql`replace(${paint.code}, '-', '')`, `${compactQuery}%`),
        ilike(paint.name, `%${q}%`),
      ),
    )
    .orderBy(paint.code)
    .limit(limit);
}

export async function getPaintByCode(code: string): Promise<PaintRow | undefined> {
  const rows = await db.select().from(paint).where(eq(paint.code, code)).limit(1);
  return rows[0];
}
