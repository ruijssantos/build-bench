import { NextResponse, type NextRequest } from "next/server";

import {
  BENCH_MEMORY_COOKIE,
  benchMemoryCookieOptions,
  benchMemoryFor,
} from "@/lib/bench-memory";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthed = token ? await verifySessionToken(token) : false;

  if (PUBLIC_PATHS.has(pathname)) {
    if (isAuthed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  rememberBenchSelection(request, response);
  return response;
}

/**
 * Records the paint the Thinner Bench is showing, so a bare `/thinner` — what
 * every nav link points at — comes back to it instead of the default.
 *
 * Done here rather than in the page because the proxy already sees every
 * request, including the RSC request behind a client-side navigation. One
 * place covers a typed URL, a search selection and the acrylic/enamel toggle
 * alike, and it costs no client JavaScript at all.
 *
 * Prefetches are skipped deliberately: merely hovering a search result
 * prefetches it, and that must not change what you come back to.
 */
function rememberBenchSelection(request: NextRequest, response: NextResponse): void {
  if (request.nextUrl.pathname !== "/thinner") return;
  if (
    request.headers.get("next-router-prefetch") ||
    request.headers.get("next-router-segment-prefetch")
  ) {
    return;
  }

  const remembered = benchMemoryFor(request.nextUrl.searchParams);
  if (remembered) response.cookies.set(BENCH_MEMORY_COOKIE, remembered, benchMemoryCookieOptions);
}

export const config = {
  // Everything except: Next internals, the PWA manifest and icons (a phone
  // may fetch these before you're logged in), and /api/login itself.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icon\\.png|apple-icon\\.png|api/login).*)",
  ],
};
