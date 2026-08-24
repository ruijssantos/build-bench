import { NextResponse, type NextRequest } from "next/server";

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

  return NextResponse.next();
}

export const config = {
  // Everything except: Next internals, the PWA manifest and icons (a phone
  // may fetch these before you're logged in), and /api/login itself.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icon\\.png|apple-icon\\.png|api/login).*)",
  ],
};
