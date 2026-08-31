import { getCataloguePaint } from "@/catalogue/paints";
import { comparePaintCodes } from "@/domain/paint-code";

/**
 * Paints vs. the shelf — docs/PLAN.md §6 Phase 4a: three buckets, derived,
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

export interface UnresolvedPaintDisplay {
  rawLabel: string;
}

export interface PaintBuckets {
  owned: OwnedPaintDisplay[];
  missing: MissingPaintDisplay[];
  unresolved: UnresolvedPaintDisplay[];
}

interface RequirementLike {
  rawLabel: string | null;
  paintCode: string | null;
}

/** A code with no catalogue hit (discontinued, or a build spec ahead of the
 * committed catalogue) still needs somewhere to render — mono code, neutral
 * grey, not dropped. */
const FALLBACK_HEX = "#c7c9d1";

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
  const unresolvedSeen = new Set<string>();
  const unresolved: UnresolvedPaintDisplay[] = [];

  for (const req of requirements) {
    if (req.paintCode) {
      const catalogue = getCataloguePaint(req.paintCode);
      const display = {
        code: req.paintCode,
        name: catalogue?.name ?? req.paintCode,
        hex: catalogue?.hex ?? FALLBACK_HEX,
      };
      (ownedCodes.has(req.paintCode) ? owned : missing).set(req.paintCode, display);
    } else if (req.rawLabel && !unresolvedSeen.has(req.rawLabel)) {
      unresolvedSeen.add(req.rawLabel);
      unresolved.push({ rawLabel: req.rawLabel });
    }
  }

  const byCode = (a: { code: string }, b: { code: string }) => comparePaintCodes(a.code, b.code);
  return {
    owned: [...owned.values()].sort(byCode),
    missing: [...missing.values()].sort(byCode),
    unresolved,
  };
}

/** Shape shared by the Stash grid's aggregate query (`KitReadiness`, one row
 * per kit) and the detail page's own per-kit buckets (derived from
 * `PaintBuckets`) — the same `ReadyLine` component renders "Own 14 of 17 ·
 * 3 to buy" from either. */
export interface ReadinessCounts {
  ownedCount: number;
  missingCount: number;
  unresolvedCount: number;
}

export function readinessCounts(buckets: PaintBuckets): ReadinessCounts {
  return {
    ownedCount: buckets.owned.length,
    missingCount: buckets.missing.length,
    unresolvedCount: buckets.unresolved.length,
  };
}
