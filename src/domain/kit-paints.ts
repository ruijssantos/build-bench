import { gunzeColour, nearestTamiyaPaints, type ColourMatch } from "@/catalogue/colour-match";
import { acrylicForLp } from "@/catalogue/lp-equivalents";
import { getCataloguePaint } from "@/catalogue/paints";
import { foreignCodeInLabel } from "@/domain/kit-paint-extraction";
import { comparePaintCodes } from "@/domain/paint-code";

/**
 * Paints vs. the shelf — docs/PLAN.md §6 Phase 4a: four buckets, derived,
 * no new table. Pure — no I/O — so the detail page's Paints panel and any
 * future screen that wants the same view can share it.
 */

export interface OwnedPaintDisplay {
  code: string;
  name: string;
  hex: string;
}

export interface MissingPaintDisplay {
  code: string;
  name: string;
  hex: string;
}

/**
 * An LP (lacquer) callout you don't own, whose X/XF twin — per Tamiya's own
 * LP compatibility chart (`catalogue/lp-equivalents.ts`) — is on the shelf.
 *
 * Not Missing: there is nothing to buy. Not Owned either, because it isn't
 * the paint the manual printed, and the difference is worth seeing — it
 * thins differently, and Tamiya notes the colours "may vary slightly". It
 * does count towards being able to build the kit (`ReadinessCounts`).
 */
export interface EquivalentPaintDisplay {
  code: string;
  name: string;
  hex: string;
  /** The owned acrylic that stands in for it. */
  substitute: { code: string; name: string; hex: string };
}

export interface UnresolvedPaintDisplay {
  rawLabel: string;
  /**
   * Nearest Tamiya paints by colour distance, when the callout names a Gunze
   * code whose swatch we hold — empty otherwise, and empty when nothing is
   * close enough to be worth offering.
   *
   * A suggestion, and deliberately nothing more. These rows stay in
   * Unresolved and never count towards Owned or Missing: a published chart
   * row means somebody compared two paints and called them equivalent, while
   * this is the distance between two screen swatches. Promoting the second
   * into the first would be exactly the confident-wrong-answer failure the
   * rest of this area keeps producing (docs/PLAN.md §5.4, §7).
   */
  closest: ColourMatch[];
}

export interface PaintBuckets {
  owned: OwnedPaintDisplay[];
  missing: MissingPaintDisplay[];
  equivalents: EquivalentPaintDisplay[];
  unresolved: UnresolvedPaintDisplay[];
}

interface RequirementLike {
  rawLabel: string | null;
  paintCode: string | null;
  /** Set once the owner has dismissed this callout — see
   * `dismissPaintRequirement`. Dismissed rows leave the bucket entirely
   * rather than rendering greyed out: the point of dismissing is to stop
   * being told, and a struck-through row still takes up the space and the
   * attention that the count was measuring. */
  dismissedAt?: Date | null;
}

/** A code with no catalogue hit (discontinued, or a build spec ahead of the
 * committed catalogue) still needs somewhere to render — mono code, neutral
 * grey, not dropped. */
const FALLBACK_HEX = "#c7c9d1";

function describe(code: string): { code: string; name: string; hex: string } {
  const catalogue = getCataloguePaint(code);
  return { code, name: catalogue?.name ?? code, hex: catalogue?.hex ?? FALLBACK_HEX };
}

/** Every code whose ownership `bucketPaintRequirements` needs to know: the
 * called-for codes, plus the acrylic twin of each LP among them. A caller
 * that only checks the first set gets every LP back as Missing. */
export function codesToCheckOnShelf(paintCodes: string[]): string[] {
  const codes = new Set(paintCodes);
  for (const code of paintCodes) {
    const acrylic = acrylicForLp(code);
    if (acrylic) codes.add(acrylic);
  }
  return [...codes];
}

/**
 * Buckets a kit's paint callouts against what's on the shelf. Distinct by
 * `paintCode` within owned/missing (one code, several shelf rows — a spray
 * can and the jar decanted from it — collapses to one chip, per §6) and by
 * `rawLabel` within unresolved (a manual repeating "MR.COLOR C8 SILVER" on
 * three parts is one thing to go look up, not three).
 */
export function bucketPaintRequirements(
  requirements: RequirementLike[],
  ownedCodes: ReadonlySet<string>,
): PaintBuckets {
  const owned = new Map<string, OwnedPaintDisplay>();
  const missing = new Map<string, MissingPaintDisplay>();
  const equivalents = new Map<string, EquivalentPaintDisplay>();
  const unresolvedSeen = new Set<string>();
  const unresolved: UnresolvedPaintDisplay[] = [];

  for (const req of requirements) {
    if (req.paintCode) {
      const display = describe(req.paintCode);
      const acrylic = acrylicForLp(req.paintCode);
      if (ownedCodes.has(req.paintCode)) {
        owned.set(req.paintCode, display);
      } else if (acrylic && ownedCodes.has(acrylic)) {
        equivalents.set(req.paintCode, { ...display, substitute: describe(acrylic) });
      } else {
        missing.set(req.paintCode, display);
      }
    } else if (req.rawLabel && !req.dismissedAt && !unresolvedSeen.has(req.rawLabel)) {
      unresolvedSeen.add(req.rawLabel);
      const foreignCode = foreignCodeInLabel(req.rawLabel);
      const hex = foreignCode ? gunzeColour(foreignCode) : null;
      unresolved.push({
        rawLabel: req.rawLabel,
        closest: hex ? nearestTamiyaPaints(hex, ownedCodes) : [],
      });
    }
  }

  const byCode = (a: { code: string }, b: { code: string }) => comparePaintCodes(a.code, b.code);
  return {
    owned: [...owned.values()].sort(byCode),
    missing: [...missing.values()].sort(byCode),
    equivalents: [...equivalents.values()].sort(byCode),
    unresolved,
  };
}

/** Shape shared by the Stash grid's aggregate query (`KitReadiness`, one row
 * per kit) and the detail page's own per-kit buckets (derived from
 * `PaintBuckets`) — the same `ReadyLine` component renders "Own 14 of 17 ·
 * 3 to buy" from either. */
export interface ReadinessCounts {
  ownedCount: number;
  /** Covered by an owned acrylic twin — see `EquivalentPaintDisplay`. On the
   * "have it" side of every total: a kit whose only gaps are these is ready
   * to build, and none of them is anything to buy. */
  equivalentCount: number;
  missingCount: number;
  unresolvedCount: number;
}

export function readinessCounts(buckets: PaintBuckets): ReadinessCounts {
  return {
    ownedCount: buckets.owned.length,
    equivalentCount: buckets.equivalents.length,
    missingCount: buckets.missing.length,
    unresolvedCount: buckets.unresolved.length,
  };
}
