/**
 * What the Thinner Bench was last showing.
 *
 * Coming back to the bench from another screen should land on the paint you
 * were actually working with, not reset to the default — you put the phone
 * down mid-build, not mid-thought. The last selection is remembered in a
 * cookie so it survives a reload and a killed PWA, and so the *server* knows
 * it: the screen renders the right paint straight away rather than flashing a
 * default and correcting itself.
 *
 * An explicit `?code=` on the URL always wins. The cookie is only the fallback
 * for a bare `/thinner`, which is what the nav links point at.
 *
 * Imported by `src/proxy.ts`, so this file must stay dependency-free.
 */

export const BENCH_MEMORY_COOKIE = "bb_bench";

export const benchMemoryCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 180, // ~180 days, same as the session
};

/**
 * The value to remember for a request, or null if there's nothing worth
 * remembering. Only `code` and `line` are kept — everything else on the URL,
 * including Next's own RSC parameters, is deliberately dropped.
 */
export function benchMemoryFor(searchParams: URLSearchParams): string | null {
  const code = searchParams.get("code")?.trim();
  if (!code) return null;

  const remembered = new URLSearchParams({ code });
  if (searchParams.get("line") === "enamel") remembered.set("line", "enamel");
  return remembered.toString();
}

/** Parses a remembered value back out. Returns null for anything malformed —
 * the cookie is client-controlled, and the caller treats an unknown code the
 * same way it treats an unknown typed one. */
export function readBenchMemory(value: string | undefined): { code: string; line: string } | null {
  if (!value) return null;

  const params = new URLSearchParams(value);
  const code = params.get("code")?.trim();
  if (!code) return null;

  return { code, line: params.get("line") === "enamel" ? "enamel" : "acrylic" };
}
