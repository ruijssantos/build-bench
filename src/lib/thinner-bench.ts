import { getActiveAirbrush, type AirbrushRow } from "@/db/repositories/airbrush";
import { getPaintByCode, type PaintRow } from "@/db/repositories/paints";
import { getOverrideForPaint, type RatioOverrideRow } from "@/db/repositories/ratio-overrides";
import { getRatioRule, type RatioRuleRow } from "@/db/repositories/ratio-rules";
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
  ratioRule: RatioRuleRow | null;
  override: RatioOverrideRow | null;
  effectiveRatio: EffectiveRatio | null;
  isAdditive: boolean;
  airbrush: AirbrushRow | null;
}

function bottleFamily(family: string): boolean {
  return family === "gloss" || family === "flat";
}

function resolveIdentity(rawCode: string, line: PaintLine, catalogueRow?: PaintRow): ResolvedPaintIdentity | null {
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
 * Resolves a raw paint-code query into everything the Thinner Bench screen needs:
 * identity, the family's ratio rule (with any override applied), and the rig
 * facts. Pure composition over the repositories — no route handler or
 * component should import the repositories directly (§4's data access
 * rule); they call this instead.
 */
export async function resolveThinnerBench(
  rawCode: string,
  line: PaintLine = "acrylic",
): Promise<ThinnerBenchBundle> {
  const code = normalizePaintCode(rawCode);
  const catalogueRow = await getPaintByCode(code);
  const paint = resolveIdentity(rawCode, line, catalogueRow);

  const [ratioRule, override, airbrush] = await Promise.all([
    paint ? getRatioRule(paint.family) : Promise.resolve(undefined),
    catalogueRow ? getOverrideForPaint(catalogueRow.code) : Promise.resolve(undefined),
    getActiveAirbrush(),
  ]);

  const isAdditive = ratioRule ? isAdditiveFamily(ratioRule) : false;
  const effectiveRatio =
    ratioRule && !isAdditive ? resolveEffectiveRatio(ratioRule, override ?? null) : null;

  return {
    query: rawCode,
    paint,
    ratioRule: ratioRule ?? null,
    override: override ?? null,
    effectiveRatio,
    isAdditive,
    airbrush: airbrush ?? null,
  };
}
