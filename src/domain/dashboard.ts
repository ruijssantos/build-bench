import { getCataloguePaint } from "@/catalogue/paints";
import { comparePaintCodes } from "@/domain/paint-code";
import type { ReadinessCounts } from "@/domain/kit-paints";

/**
 * The Dashboard's derived vocabulary — docs/PLAN.md §6 Phase 6. Pure, no
 * I/O: every module on that screen is a composition over data Phases 2–4a
 * already store, so what belongs here is the shaping, not the fetching.
 */

/** A code with no catalogue hit still needs somewhere to render — same
 * fallback and reasoning as `kit-paints.ts`. */
const FALLBACK_HEX = "#c7c9d1";

export type ShopRunReason = "missing" | "low";

export interface ShopRunEntry {
  code: string;
  name: string;
  hex: string;
  reason: ShopRunReason;
  /** Only set for `missing` — how many unfinished kits call for it. A `low`
   * bottle is on the shelf, so no kit is currently blocked on it. */
  kitCount?: number;
}

interface ShopRunPaintLike {
  paintCode: string;
  kitCount: number;
}

interface ShelfRowLike {
  paintCode: string;
  state: string | null;
}

/**
 * The shop list, in the order you would actually shop it: paints a kit needs
 * and you don't have, then bottles you have but are running out of.
 *
 * The two halves answer different questions and are deliberately not merged
 * into one ranking — "I cannot start this kit" outranks "I will run out
 * soon", however many kits the low bottle happens to touch. A code that is
 * both (missing for one kit, low on the shelf) is impossible by
 * construction: the missing half is an anti-join against the shelf, so
 * anything with a shelf row is excluded from it.
 */
export function buildShopRun(
  missing: ShopRunPaintLike[],
  shelf: ShelfRowLike[],
): ShopRunEntry[] {
  const entries: ShopRunEntry[] = missing
    .map((row) => ({ ...describe(row.paintCode), reason: "missing" as const, kitCount: row.kitCount }))
    .sort(byCode);

  // Distinct by code: a spray can and the jar decanted from it are two shelf
  // rows, and marking either low is one thing to buy.
  const lowCodes = [...new Set(shelf.filter((row) => row.state === "low").map((row) => row.paintCode))];

  return entries.concat(
    lowCodes.map((code) => ({ ...describe(code), reason: "low" as const })).sort(byCode),
  );
}

function describe(code: string): { code: string; name: string; hex: string } {
  const catalogue = getCataloguePaint(code);
  return { code, name: catalogue?.name ?? code, hex: catalogue?.hex ?? FALLBACK_HEX };
}

function byCode(a: { code: string }, b: { code: string }): number {
  return comparePaintCodes(a.code, b.code);
}

/**
 * Whether a kit can be started tonight without a shop run.
 *
 * A kit with no extracted paint list at all is NOT ready — it is unknown,
 * which is a different thing and must not be presented as a green light. So
 * this needs both "nothing missing" and "something was actually checked".
 */
export function isReadyToBuild(readiness: ReadinessCounts | undefined): boolean {
  if (!readiness) return false;
  return readiness.missingCount === 0 && readiness.ownedCount + readiness.missingCount > 0;
}
