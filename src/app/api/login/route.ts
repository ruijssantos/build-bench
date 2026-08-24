import { NextResponse } from "next/server";

import { verifyPassphrase } from "@/lib/passphrase";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/session";

// Only accept a same-origin relative path — the submitted `from` value is
// user-controlled form data, and an unchecked redirect target is an open
// redirect.
function safeRedirectPath(value: string): string {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const passphrase = String(formData.get("passphrase") ?? "");
  const from = safeRedirectPath(String(formData.get("from") ?? "/"));

  if (!verifyPassphrase(passphrase)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    if (from !== "/") url.searchParams.set("from", from);
    return NextResponse.redirect(url, { status: 303 });
  }

  const token = await createSessionToken();
  const response = NextResponse.redirect(new URL(from, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
  return response;
}
