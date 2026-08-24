import { NextResponse, type NextRequest } from "next/server";

import { resolveThinnerBench, type PaintLine } from "@/lib/thinner-bench";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/thinner-bench/[code]">) {
  const { code } = await ctx.params;
  const lineParam = request.nextUrl.searchParams.get("line");
  const line: PaintLine = lineParam === "enamel" ? "enamel" : "acrylic";

  const bundle = await resolveThinnerBench(decodeURIComponent(code), line);
  return NextResponse.json(bundle);
}
