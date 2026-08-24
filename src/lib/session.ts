import { SignJWT, jwtVerify } from "jose";

/**
 * Signed session cookie — docs/PLAN.md §1.1. One passphrase, no accounts
 * table. Edge-safe: this file runs in middleware (Edge runtime), so it
 * uses jose + atob rather than node:crypto/Buffer, neither of which is
 * guaranteed available there.
 */

export const SESSION_COOKIE_NAME = "bb_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // ~180 days — long, so the phone
// never logs you out at the bench with wet hands.

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return base64ToUint8Array(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
