import type { PaintLine } from "@/lib/thinner-bench";

/** TS-8 by default — matches the design reference's populated example rather
 * than an empty state, so the screen is immediately useful on first open. */
export const DEFAULT_CODE = "TS-8";

export type BenchSearchParams = Record<string, string | string[] | undefined>;

export function readBenchParams(searchParams: BenchSearchParams): {
  code: string;
  line: PaintLine;
} {
  const raw = searchParams.code;
  const code = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_CODE;
  return { code, line: searchParams.line === "enamel" ? "enamel" : "acrylic" };
}
