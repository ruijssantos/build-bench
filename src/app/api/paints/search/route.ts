import { NextResponse, type NextRequest } from "next/server";

import { searchCatalogue } from "@/catalogue/paints";

/**
 * Type-ahead over the catalogue, served from the compiled index — no database
 * round trip, so this answers in microseconds. The bench's own search box no
 * longer needs it (it matches locally against the same index), but this stays
 * as the server-side entry point for the same query.
 */
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = searchCatalogue(q, 8).map((p) => ({
    code: p.code,
    name: p.name,
    hex: p.hex,
    family: p.family,
    finish: p.finish,
  }));

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
