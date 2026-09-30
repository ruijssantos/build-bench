import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { ACRYLIC_TWIN_PAIRS } from "@/catalogue/acrylic-twins";
import { inventoryItem } from "@/db/schema";

/**
 * A second shelf join for the Equivalents bucket (`domain/kit-paints.ts`): a
 * requirement's LP or TS code mapped to its X/XF twin, joined against the shelf, so
 * SQL can tell "missing" from "covered by an acrylic you own" without a round
 * trip per kit. The detail page decides the same thing in
 * `bucketPaintRequirements`; the two must agree, so both read the one table in
 * `catalogue/acrylic-twins.ts`.
 *
 * A `case` over the chart's literal pairs (82: 51 LP, 31 TS) rather than a lookup table: the chart is
 * compiled into the build like the rest of the catalogue (§3.1), and a table
 * would be one more seed step that could lag the code. Codes the chart has no
 * acrylic for fall through to `null` and never join.
 */
export const substituteShelf = alias(inventoryItem, "substitute_shelf");

export function acrylicTwinCode(paintCode: SQLWrapper): SQL {
  const branches = ACRYLIC_TWIN_PAIRS.map(([code, acrylic]) => sql`when ${code} then ${acrylic}`);
  return sql`(case ${paintCode} ${sql.join(branches, sql` `)} end)`;
}
