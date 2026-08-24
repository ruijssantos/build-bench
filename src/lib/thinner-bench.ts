import { getCataloguePaint, type CataloguePaint } from "@/catalogue/paints";
import { getCatalogueRatioRule, type CatalogueRatioRule } from "@/catalogue/ratio-rules";
import { getActiveAirbrush, type AirbrushRow } from "@/db/repositories/airbrush";
import { getOverrideForPaint, type RatioOverrideRow } from "@/db/repositories/ratio-overrides";
import {
  familyFromLinePrefix,
  normalizePaintCode,
  type RatioFamily,
} from "@/domain/paint-code";
import { isAdditiveFamily, resolveEffectiveRatio, type EffectiveRatio } from "@/domain/ratio";

/** The line the user says they're mixing from — only matters for a code that's
 * ambiguously sold as both an acrylic bottle and, historically, an enamel one. */
export type PaintLine = "acrylic" | "enamel";

export interface ResolvedPaintIdentity {
  code: string;
  name: string;
  hex: string;
  family: RatioFamily;
  finish: string | null;
  /** True when this code has a real row in the `paint` catalogue. */
  known: boolean;
  /** True when the acrylic/enamel toggle applies to this code (a bottle-line X/XF colour). */
  ambiguous: boolean;
}

export interface ThinnerBenchBundle {
  query: string;
  /** null when the query doesn't even look like a Tamiya code (unknown line prefix). */
  paint: ResolvedPaintIdentity | null;
  ratioRule: CatalogueRatioRule | null;
  override: RatioOverrideRow | null;
  effectiveRatio: EffectiveRatio | null;
  isAdditive: boolean;
  airbrush: AirbrushRow | null;
}

function bottleFamily(family: string): boolean {
  return family === "gloss" || family === "flat";
}

function resolveIdentity(
  rawCode: string,
  line: PaintLine,
  catalogueRow?: CataloguePaint,
): ResolvedPaintIdentity | null {
  const code = normalizePaintCode(rawCode);

  if (catalogueRow) {
    const ambiguous = bottleFamily(catalogueRow.family ?? "");
    const family = (line === "enamel" && ambiguous ? "enamel" : catalogueRow.family) as RatioFamily;
    return {
      code: catalogueRow.code,
      name: catalogueRow.name ?? code,
      hex: catalogueRow.hex ?? "#6c7176",
      family,
      finish: catalogueRow.finish,
      known: true,
      ambiguous,
    };
  }

  const fallbackFamily = familyFromLinePrefix(code);
  if (!fallbackFamily) return null;

  const ambiguous = bottleFamily(fallbackFamily);
  const family = ambiguous && line === "enamel" ? "enamel" : fallbackFamily;
  const linePrefix = (code.match(/^[A-Z]+/) ?? [""])[0];
  return {
    code,
    name: `Not in the catalogue — ratio from the ${linePrefix} range`,
    hex: "#6c7176",
    family,
    finish: null,
    known: false,
    ambiguous,
  };
}

/**
 * The half of the bench that needs no database at all: which paint this is,
 * and what its family's rule says. Both come from the compiled catalogue, so
 * this is synchronous, free, and safe to call during a prerender.
 *
 * Split out from `resolveThinnerBench` deliberately — it lets a caller render
 * everything a paint code determines without waiting on the rig row or a
 * correction, which is what keeps the screen's static shell useful.
 */
export function resolvePaintIdentity(
  rawCode: string,
  line: PaintLine = "acrylic",
): { paint: ResolvedPaintIdentity | null; ratioRule: CatalogueRatioRule | null } {
  const paint = resolveIdentity(rawCode, line, getCataloguePaint(normalizePaintCode(rawCode)));
  return {
    paint,
    ratioRule: paint ? getCatalogueRatioRule(paint.family) ?? null : null,
  };
}

/**
 * Resolves a raw paint-code query into everything the Thinner Bench screen
 * needs: identity, the family's ratio rule (with any override applied), and
 * the rig facts.
 *
 * Identity and the rule are compiled in; only the correction and the rig row
 * are queried, and those two run in parallel — one round trip's worth of
 * latency for the whole screen, both of them cached.
 */
export async function resolveThinnerBench(
  rawCode: string,
  line: PaintLine = "acrylic",
): Promise<ThinnerBenchBundle> {
  const { paint, ratioRule } = resolvePaintIdentity(rawCode, line);

  const [override, airbrush] = await Promise.all([
    paint?.known ? getOverrideForPaint(paint.code) : Promise.resolve(undefined),
    getActiveAirbrush(),
  ]);

  const isAdditive = ratioRule ? isAdditiveFamily(ratioRule) : false;
  const effectiveRatio =
    ratioRule && !isAdditive ? resolveEffectiveRatio(ratioRule, override ?? null) : null;

  return {
    query: rawCode,
    paint,
    ratioRule,
    override: override ?? null,
    effectiveRatio,
    isAdditive,
    airbrush: airbrush ?? null,
  };
}
