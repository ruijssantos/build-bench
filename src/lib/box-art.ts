import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { del, put } from "@vercel/blob";

/**
 * Box art, fetched once at save time — docs/PLAN.md §2.4, §4.3. A kit's
 * `image_url` is never a Scalemates (or anywhere else) hotlink: this is the
 * one place that boundary is crossed, and it crosses it exactly once per
 * kit, copying the bytes into Vercel Blob and handing back that URL instead.
 *
 * Deliberately permissive about *failure*. The source is whatever a Claude
 * web search turned up (§5.1 stage A) — it can 404, redirect somewhere odd,
 * or turn out not to be an image at all — and none of that should stop the
 * kit itself from saving. `null` here just means the saved kit shows without
 * box art, the same as a manually-entered one.
 *
 * Deliberately *not* permissive about where it will connect. This function
 * takes a URL chosen by a language model and passed through a Server Action,
 * and then makes a server-side request to it — a textbook SSRF sink. A
 * protocol check alone is not enough: `http://169.254.169.254/…` is the
 * cloud metadata endpoint and `http://127.0.0.1:3000/…` is this app talking
 * to itself, both of which pass a protocol check and neither of which a
 * public image host has any business being. So every hop is resolved to its
 * actual IP addresses and rejected unless all of them are public unicast,
 * and redirects are followed by hand so a 302 can't step around the check
 * that the first URL passed.
 */

const MAX_BYTES = 8 * 1024 * 1024;
/** Enough of a page to reach the `<head>` on any real site; a page that
 * hasn't declared its Open Graph image in the first megabyte isn't going to. */
const MAX_HTML_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/** Lower-cased keys: HTTP media types are case-insensitive, and a host that
 * answers `Content-Type: IMAGE/JPEG` is serving a perfectly good JPEG. A Map
 * rather than an object literal so a value like `constructor` can't match an
 * inherited property instead of missing. */
const EXTENSION_BY_CONTENT_TYPE = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
]);

/**
 * Is this a public unicast address — i.e. somewhere on the internet, rather
 * than inside the network this function is running in?
 *
 * Covers the ranges that matter for SSRF: loopback, RFC 1918 private space,
 * link-local (which is where the cloud metadata service lives), carrier-grade
 * NAT, and the IPv6 equivalents. IPv4-mapped IPv6 (`::ffff:10.0.0.1`) is
 * unwrapped first so it can't smuggle a private v4 address past the v6 checks.
 */
function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) return false;

  if (version === 4) {
    const octets = address.split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return false;
    const [a, b] = octets;

    if (a === 0) return false; // "this network"
    if (a === 10) return false; // RFC 1918
    if (a === 127) return false; // loopback
    if (a === 169 && b === 254) return false; // link-local — cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false; // RFC 1918
    if (a === 192 && b === 168) return false; // RFC 1918
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 192 && b === 0) return false; // IETF protocol assignments
    if (a >= 224) return false; // multicast, reserved, broadcast
    return true;
  }

  const normalized = address.toLowerCase().split("%")[0];

  // IPv4-mapped / IPv4-compatible: judge the v4 address it carries.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return isPublicAddress(mapped[1]);

  if (normalized === "::" || normalized === "::1") return false; // unspecified, loopback
  if (/^f[cd]/.test(normalized)) return false; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(normalized)) return false; // fe80::/10 link-local
  if (normalized.startsWith("ff")) return false; // multicast
  return true;
}

/** Parses a URL and rejects it unless it is http(s) and every address its
 * hostname resolves to is public. Returns the parsed URL, or `null`. */
async function safeUrl(raw: string): Promise<URL | null> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  // A hostname that is already a literal IP never reaches DNS.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return isPublicAddress(hostname) ? parsed : null;

  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return null;
    // Every answer must be public: one private record is enough to reject.
    if (!addresses.every((entry) => isPublicAddress(entry.address))) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Fetches a URL with every hop re-checked against `safeUrl`.
 *
 * Redirects by hand: `fetch`'s own following would re-point at a host that
 * never passed `safeUrl`, which is the standard way an allowlist on the
 * first URL gets bypassed. Returns the final response and the URL it
 * actually came from — the latter matters for resolving relative `og:image`
 * values against the page that declared them.
 */
async function safeFetch(
  rawUrl: string,
  accept: string,
  timeoutMs: number,
): Promise<{ response: Response; url: URL } | null> {
  let target = await safeUrl(rawUrl);
  if (!target) return null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: accept,
        // A plain `fetch` announces no user agent at all, which a fair number
        // of hosts answer with a 403. Naming a real browser build is what
        // gets a normal page back, and this only ever reads public pages.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return null;
      const next = await safeUrl(new URL(location, target).href);
      if (!next) return null;
      target = next;
      continue;
    }

    return { response, url: target };
  }

  return null;
}

/**
 * Reads the body with a running byte count, stopping the moment it passes
 * the cap. Buffering first and measuring afterwards would let a host that
 * streams unbounded bytes under an image content-type OOM the function
 * before the check ever ran.
 */
async function readCapped(response: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const body = response.body;
  if (!body) return null;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  if (total === 0) return null;
  return Buffer.concat(chunks);
}

/** Does this URL's path already name an image file? Lets an obvious direct
 * image URL skip the round trip that would otherwise be needed just to read
 * its content type. */
function looksLikeImageUrl(url: string): boolean {
  try {
    return /\.(jpe?g|png|webp|gif|avif)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Pulls the Open Graph image out of a page.
 *
 * This is the piece that makes box art actually work. Asking a web search to
 * hand back a *direct image URL* doesn't survive contact with reality — the
 * search sees page text and links, so the honest answer is usually "no image
 * found", which is exactly the empty card this used to produce. What a search
 * reliably does find is the kit's *page*, and essentially every product page
 * on every retailer and reference site declares `og:image`: a real, direct,
 * usually CDN-hosted image URL that exists precisely so other sites can
 * display it. Reading that is far more dependable than hoping for a lucky
 * direct link.
 *
 * Attribute-order tolerant (`content` before `property` is just as valid),
 * and falls back through the Twitter card equivalents, which some sites set
 * and others don't.
 */
function extractPageImage(html: string, pageUrl: URL): string | null {
  const wanted = ["og:image:secure_url", "og:image:url", "og:image", "twitter:image", "twitter:image:src"];
  const found = new Map<string, string>();

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const value = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && value && wanted.includes(key) && !found.has(key)) {
      found.set(key, value);
    }
  }

  for (const key of wanted) {
    const value = found.get(key)?.trim();
    if (!value) continue;
    try {
      // Relative values are legal and common — resolve against the page the
      // tag was actually served from, redirects included.
      return new URL(value, pageUrl).href;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Turns whatever URL we have for a kit into a direct image URL, or `null`.
 *
 * Takes either a direct image URL or a page URL — the caller rarely knows
 * which it has, and this is the one place that distinction gets resolved.
 * Deliberately single-hop: a page's `og:image` is used as-is rather than
 * being followed and re-parsed, so a site that points its Open Graph tag at
 * another HTML page just fails instead of walking the web.
 */
export async function resolveBoxArtUrl(
  sourceUrl: string | null,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<string | null> {
  if (!sourceUrl) return null;

  // An obvious image URL is taken at its word — fetching it here would mean
  // downloading the whole image just to learn what we can already see.
  if (looksLikeImageUrl(sourceUrl)) return sourceUrl;

  try {
    const fetched = await safeFetch(sourceUrl, "text/html,image/*", timeoutMs);
    if (!fetched || !fetched.response.ok) {
      await fetched?.response.body?.cancel();
      return null;
    }

    const contentType = (fetched.response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

    // Already an image, just without a telling extension.
    if (EXTENSION_BY_CONTENT_TYPE.has(contentType)) {
      await fetched.response.body?.cancel();
      return fetched.url.href;
    }

    if (!contentType.startsWith("text/html") && !contentType.startsWith("application/xhtml")) {
      await fetched.response.body?.cancel();
      return null;
    }

    const bytes = await readCapped(fetched.response, MAX_HTML_BYTES);
    if (!bytes) return null;

    const image = extractPageImage(bytes.toString("utf-8"), fetched.url);
    if (!image) return null;

    // The extracted URL is attacker-influenced in exactly the same way the
    // original was, so it goes through the same check rather than being
    // trusted for having come from a page we just read.
    return (await safeUrl(image)) ? image : null;
  } catch {
    return null;
  }
}

/**
 * Copies box art into Blob and returns the stored URL.
 *
 * Accepts a page URL as readily as a direct image URL — `resolveBoxArtUrl`
 * sorts out which it was given.
 */
export async function saveBoxArt(sourceUrl: string | null): Promise<string | null> {
  const imageUrl = await resolveBoxArtUrl(sourceUrl);
  if (!imageUrl) return null;

  try {
    const fetched = await safeFetch(imageUrl, "image/*", FETCH_TIMEOUT_MS);
    if (!fetched || !fetched.response.ok) {
      await fetched?.response.body?.cancel();
      return null;
    }

    const contentType = (fetched.response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const extension = EXTENSION_BY_CONTENT_TYPE.get(contentType);
    if (!extension) {
      await fetched.response.body?.cancel();
      return null;
    }

    const bytes = await readCapped(fetched.response, MAX_BYTES);
    if (!bytes) return null;

    const blob = await put(`kits/${crypto.randomUUID()}${extension}`, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  } catch {
    return null;
  }
}

/**
 * Drops the stored blob when the kit that referenced it goes away. Without
 * this every mistaken add-then-remove leaves a permanently public object
 * that nothing in the app can list or reach again.
 *
 * Best-effort by the same rule as `saveBoxArt`: a failed cleanup must not
 * take the removal down with it. Guarded on the Blob host so a hand-entered
 * `image_url` pointing somewhere else could never turn this into a
 * delete-arbitrary-URL call.
 */
export async function deleteBoxArt(imageUrl: string | null): Promise<void> {
  if (!imageUrl) return;
  try {
    const parsed = new URL(imageUrl);
    if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return;
    await del(imageUrl);
  } catch {
    // The row is going regardless; an orphaned blob is not worth failing on.
  }
}
