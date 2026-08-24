import { NextResponse, type NextRequest } from "next/server";

import { getPaintByCode } from "@/db/repositories/paints";
import { createOverride } from "@/db/repositories/ratio-overrides";
import { resolveThinnerBench } from "@/lib/thinner-bench";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/thinner-bench/[code]/override">) {
  const { code } = await ctx.params;
  const paintCode = decodeURIComponent(code);

  const catalogueRow = await getPaintByCode(paintCode);
  if (!catalogueRow) {
    return NextResponse.json(
      { error: "Only a catalogued paint code can be corrected." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const paintParts = body?.paintParts;
  const thinnerParts = body?.thinnerParts;
  if (!isFiniteNumber(paintParts) || !isFiniteNumber(thinnerParts)) {
    return NextResponse.json(
      { error: "paintParts and thinnerParts must both be positive numbers." },
      { status: 400 },
    );
  }

  await createOverride({
    paintCode,
    paintParts,
    thinnerParts,
    psiText: typeof body?.psiText === "string" && body.psiText.trim() ? body.psiText.trim() : null,
    reason: typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
  });

  const bundle = await resolveThinnerBench(paintCode);
  return NextResponse.json(bundle);
}
