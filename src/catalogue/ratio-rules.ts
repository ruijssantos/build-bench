import type { RatioRuleLike } from "@/domain/ratio";

import ratioRuleSeed from "../../seed/ratio-rules.json";

/**
 * The eleven family ratio rules, compiled into the build for the same reasons
 * as the paint catalogue — see `./paints.ts`. Eleven rows that change only
 * when someone edits `seed/ratio-rules.json` and redeploys have no business
 * costing a round trip on every page view.
 */

interface SeedRatioRule {
  family: string;
  thinner_type: string | null;
  paint_parts: number | null;
  thinner_parts: number | null;
  window_lo: number | null;
  window_hi: number | null;
  psi_text: string | null;
  coats_text: string | null;
  distance_text: string | null;
  notes: string[];
}

export interface CatalogueRatioRule extends RatioRuleLike {
  family: string;
  thinnerType: string | null;
  paintParts: number | null;
  thinnerParts: number | null;
  windowLo: number | null;
  windowHi: number | null;
  psiText: string | null;
  coatsText: string | null;
  distanceText: string | null;
  notes: string[];
}

const BY_FAMILY = new Map(
  (ratioRuleSeed as SeedRatioRule[]).map((rule): [string, CatalogueRatioRule] => [
    rule.family,
    {
      family: rule.family,
      thinnerType: rule.thinner_type,
      paintParts: rule.paint_parts,
      thinnerParts: rule.thinner_parts,
      windowLo: rule.window_lo,
      windowHi: rule.window_hi,
      psiText: rule.psi_text,
      coatsText: rule.coats_text,
      distanceText: rule.distance_text,
      notes: rule.notes,
    },
  ]),
);

export function getCatalogueRatioRule(family: string): CatalogueRatioRule | undefined {
  return BY_FAMILY.get(family);
}
