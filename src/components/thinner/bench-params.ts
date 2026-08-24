import { cookies } from "next/headers";

import { BENCH_MEMORY_COOKIE, readBenchMemory } from "@/lib/bench-memory";
import type { PaintLine } from "@/lib/thinner-bench";

/** TS-8 on a bench that has never been used — it matches the design
 * reference's populated example rather than an empty state, so the screen is
 * immediately useful on first open. Once you've looked at a paint, that's what
 * comes back instead. */
export const DEFAULT_CODE = "TS-8";

export type BenchSearchParams = Record<string, string | string[] | undefined>;

export interface BenchParams {
  code: string;
  line: PaintLine;
}

/**
 * Which paint this screen is showing, in precedence order:
 *
 *   1. `?code=` on the URL — explicit, shareable, always wins.
 *   2. The last selection, from the cookie the proxy writes.
 *   3. The default.
 *
 * So a bare `/thinner` — what every nav link points at — means "the bench,
 * where I left it", and `/thinner?code=XF-64` is the form you'd send someone.
 *
 * Reads no database and does no I/O beyond resolving two promises, so at
 * request time this settles in the first flush of HTML.
 */
export async function resolveBenchParams(
  searchParams: Promise<BenchSearchParams>,
): Promise<BenchParams> {
  const params = await searchParams;

  const fromUrl = typeof params.code === "string" ? params.code.trim() : "";
  if (fromUrl) {
    return { code: fromUrl, line: params.line === "enamel" ? "enamel" : "acrylic" };
  }

  const remembered = readBenchMemory((await cookies()).get(BENCH_MEMORY_COOKIE)?.value);
  if (remembered) {
    return { code: remembered.code, line: remembered.line === "enamel" ? "enamel" : "acrylic" };
  }

  return { code: DEFAULT_CODE, line: "acrylic" };
}
