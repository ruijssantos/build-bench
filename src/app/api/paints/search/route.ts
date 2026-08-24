import { NextResponse, type NextRequest } from "next/server";

import { searchPaints } from "@/db/repositories/paints";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchPaints(q, 8);
  return NextResponse.json({
    results: results.map((p) => ({
      code: p.code,
      name: p.name,
      hex: p.hex,
      family: p.family,
      finish: p.finish,
    })),
  });
}
