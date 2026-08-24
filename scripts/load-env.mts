/**
 * Loads .env.local into process.env for standalone scripts run via `tsx`,
 * mirroring what `next dev`/`next build` already do automatically for the
 * app itself. A no-op when the file doesn't exist (CI, or anywhere env vars
 * are already injected directly, e.g. a real deploy step) — existing
 * process.env values always win over the file per Node's loadEnvFile.
 */
export function loadLocalEnv(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local here — fine, the caller's own process.env is authoritative.
  }
}
