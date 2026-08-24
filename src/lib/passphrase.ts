import { createHash, timingSafeEqual } from "node:crypto";

/**
 * node:crypto — Node runtime only. Never import this from middleware.ts
 * (Edge runtime); use session.ts there instead.
 */
export function verifyPassphrase(input: string): boolean {
  const expected = process.env.APP_PASSPHRASE;
  if (!expected) return false;

  // Hash both sides to a fixed-length digest before comparing — timingSafeEqual
  // throws on mismatched buffer lengths, and raw passphrases rarely match in
  // length, which would otherwise leak length via the exception path.
  const inputHash = createHash("sha256").update(input).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(inputHash, expectedHash);
}
