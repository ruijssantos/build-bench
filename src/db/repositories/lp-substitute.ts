import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { LP_ACRYLIC_PAIRS } from "@/catalogue/lp-equivalents";
import { inventoryItem } from "@/db/schema";

/**
 * A second shelf join for the Equivalents bucket (`domain/kit-paints.ts`): a
 * requirement's LP code mapped to its X/XF twin, joined against the shelf, so
 * SQL can tell "missing" from "covered by an acrylic you own" without a round
 * trip per kit. The detail page decides the same thing in
 * `bucketPaintRequirements`; the two must agree, so both read the one table in
 * `catalogue/lp-equivalents.ts`.
 *
 * A `case` over 51 literal pairs rather than a lookup table: the chart is
 * compiled into the build like the rest of the catalogue (§3.1), and a table
 * would be one more seed step that could lag the code. Non-LP codes fall
 * through to `null` and never join.
 */
export const substituteShelf = alias(inventoryItem, "substitute_shelf");

export function lpAcrylicCode(paintCode: SQLWrapper): SQL {
  const branches = LP_ACRYLIC_PAIRS.map(([lp, acrylic]) => sql`when ${lp} then ${acrylic}`);
  return sql`(case ${paintCode} ${sql.join(branches, sql` `)} end)`;
}
