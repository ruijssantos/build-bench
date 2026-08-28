import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  BlobAccessError,
  BlobContentTypeNotAllowedError,
  BlobError,
  BlobFileTooLargeError,
  BlobServiceNotAvailable,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  del,
  put,
} from "@vercel/blob";

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

/** "vercel_blob_rw_<storeId>_<secret>" — the same parse `@vercel/blob` itself
 * does internally (its `parseStoreIdFromReadWriteToken`) to build a blob's
 * URL as `https://<storeId>.public.blob.vercel-storage.com/...`. Exposed here
 * so the wishlist page can preconnect to that origin without a network
 * round trip to discover it — see docs/PERFORMANCE.md, Wishlist section. */
export function blobStoreOrigin(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const storeId = token.split("_")[3];
  return storeId ? `https://${storeId}.public.blob.vercel-storage.com` : null;
}
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
 * Every outcome of trying to get box art, success or failure.
 *
 * The `reason` is written to be shown to a person, because it is: the Edit
 * dialog's "Fetch from link" reports it directly. Two rounds of this feature
 * failed silently — `null` meant "no art" whether the page 403'd, had no
 * Open Graph tag, or was never fetched at all — which left no way to tell
 * a bug from a site that simply won't serve us. Everything below says which.
 */
export type BoxArtResult = { ok: true; url: string } | { ok: false; reason: string };

/** One structured line per attempt, in the function logs. Box art crosses to
 * hosts we don't control and can't test against from a dev machine, so when
 * it fails in production the log is the only account of what happened. */
function log(event: string, detail: Record<string, unknown>): void {
  console.log(`[box-art] ${event} ${JSON.stringify(detail)}`);
}

/**
 * Turns a Blob write failure into something the person looking at the screen
 * can act on.
 *
 * These messages name environment variables, which is unusual for user-facing
 * copy and right here: this is a single-user app whose one user administers
 * its Vercel project (§1.1). A generic "try again" cost a full debugging round
 * trip on a store misconfiguration that the SDK had already identified
 * precisely. None of these leak the token itself — only whether it works.
 */
export function describeBlobError(error: unknown): string {
  if (error instanceof BlobAccessError) {
    return "Vercel Blob rejected the token. Check BLOB_READ_WRITE_TOKEN in the project's environment variables, then redeploy.";
  }
  if (error instanceof BlobStoreNotFoundError) {
    return "That Blob store doesn't exist. Reconnect the store in Vercel → Storage, then redeploy so the new token is picked up.";
  }
  if (error instanceof BlobStoreSuspendedError) {
    return "The Blob store is suspended — check its status in Vercel → Storage.";
  }
  if (error instanceof BlobServiceNotAvailable) {
    return "Vercel Blob is unavailable right now — try again in a moment.";
  }
  if (error instanceof BlobFileTooLargeError || error instanceof BlobContentTypeNotAllowedError) {
    return error.message;
  }

  // The base class, checked after every subclass above. This is the branch a
  // missing or unconfigured token actually lands in — `put` throws a plain
  // `BlobError` for that, not one of the typed ones — and leaving it to fall
  // through to the generic line below is what made every Blob failure look
  // identical no matter what was wrong. The SDK's own message is specific and
  // safe to show: it never echoes the token, only whether one was found.
  if (error instanceof BlobError) {
    if (error.message.includes("No read-write token found")) {
      return "No Blob token is configured. Connect a Blob store in Vercel → Storage, then redeploy so BLOB_READ_WRITE_TOKEN reaches the running deployment.";
    }
    if (error.message.includes("private store")) {
      // Access mode is fixed when a store is created, so this one can't be
      // toggled — hence "create a new store" rather than "change the setting".
      return "This Blob store is private, and box art has to be public to show in the app. Create a new store with public access in Vercel → Storage, connect it to the project, and redeploy. See docs/PLAN.md §9.2.";
    }
    return error.message;
  }

  // Anything else — a network failure reaching Blob, most likely. The detail
  // goes on screen rather than into a log only: this app has one user, who
  // administers its Vercel project, and "try again" has already cost several
  // rounds of guessing at errors that were perfectly well described.
  const detail = error instanceof Error ? error.message : String(error);
  return `Couldn't store that image — ${detail.slice(0, 200)}`;
}

/**
 * Hosts that answer a server-side fetch with a challenge page rather than
 * their content, so there is nothing to be gained by asking.
 *
 * Scalemates is the one that matters here: it is the best kit reference on
 * the web and the natural `scalematesUrl` for almost every candidate, and it
 * returns 403 to a datacenter IP every time. Reading its Open Graph image was
 * a good idea that simply cannot work from a serverless function. Skipping it
 * outright — rather than spending a request and a timeout on it per candidate,
 * per search — is why this list exists. It stays the kit's *link*; it just
 * isn't asked for pictures.
 */
const ART_HOSTILE_HOSTS = ["scalemates.com"];

function isArtHostile(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ART_HOSTILE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}

/** A status a site returns when it has decided we're a robot, as opposed to
 * one that means the page genuinely isn't there. Worth telling apart: the
 * first is permanent for this approach and the user should upload a photo,
 * the second might just be a bad URL. */
const BOT_BLOCK_STATUSES = new Set([401, 403, 405, 406, 429, 503]);

function describeStatus(status: number, host: string): string {
  if (BOT_BLOCK_STATUSES.has(status)) {
    return `${host} blocked the request (HTTP ${status}) — it doesn't allow automated fetching. Upload a photo instead.`;
  }
  return `${host} returned HTTP ${status}.`;
}

/**
 * Turns whatever URL we have for a kit into a direct image URL.
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
): Promise<BoxArtResult> {
  if (!sourceUrl) return { ok: false, reason: "No link to read box art from." };

  // An obvious image URL is taken at its word — fetching it here would mean
  // downloading the whole image just to learn what we can already see. Note
  // this runs before the hostile-host check on purpose: a direct image URL
  // on such a host is still worth trying, since it's the page HTML that gets
  // challenged, not usually the image CDN behind it.
  if (looksLikeImageUrl(sourceUrl)) return { ok: true, url: sourceUrl };

  if (isArtHostile(sourceUrl)) {
    log("skipped-hostile-host", { source: sourceUrl });
    return {
      ok: false,
      reason: "Scalemates blocks automated requests, so its pictures can't be fetched. Paste an image URL or upload a photo instead.",
    };
  }

  const host = (() => {
    try {
      return new URL(sourceUrl).host;
    } catch {
      return "that link";
    }
  })();

  try {
    const fetched = await safeFetch(sourceUrl, "text/html,image/*", timeoutMs);
    if (!fetched) {
      log("unreachable", { source: sourceUrl });
      return { ok: false, reason: `Couldn't reach ${host}.` };
    }
    if (!fetched.response.ok) {
      await fetched.response.body?.cancel();
      log("page-not-ok", { source: sourceUrl, status: fetched.response.status });
      return { ok: false, reason: describeStatus(fetched.response.status, host) };
    }

    const contentType = (fetched.response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

    // Already an image, just without a telling extension.
    if (EXTENSION_BY_CONTENT_TYPE.has(contentType)) {
      await fetched.response.body?.cancel();
      return { ok: true, url: fetched.url.href };
    }

    if (!contentType.startsWith("text/html") && !contentType.startsWith("application/xhtml")) {
      await fetched.response.body?.cancel();
      log("not-a-page", { source: sourceUrl, contentType });
      return { ok: false, reason: `${host} didn't return a web page or an image.` };
    }

    const bytes = await readCapped(fetched.response, MAX_HTML_BYTES);
    if (!bytes) {
      log("page-unreadable", { source: sourceUrl });
      return { ok: false, reason: `Couldn't read the page at ${host}.` };
    }

    const image = extractPageImage(bytes.toString("utf-8"), fetched.url);
    if (!image) {
      log("no-og-image", { source: sourceUrl, bytes: bytes.byteLength });
      return { ok: false, reason: `No box art image is published on that ${host} page.` };
    }

    // The extracted URL is attacker-influenced in exactly the same way the
    // original was, so it goes through the same check rather than being
    // trusted for having come from a page we just read.
    if (!(await safeUrl(image))) {
      log("og-image-rejected", { source: sourceUrl, image });
      return { ok: false, reason: `The image ${host} points at isn't reachable.` };
    }

    log("resolved", { source: sourceUrl, image });
    return { ok: true, url: image };
  } catch (error) {
    log("threw", { source: sourceUrl, error: error instanceof Error ? error.message : String(error) });
    return { ok: false, reason: `Couldn't reach ${host}.` };
  }
}

/**
 * Copies box art into Blob and returns the stored URL.
 *
 * Takes an ordered list of candidate sources — a direct image URL, a
 * retailer page, the Scalemates page — and uses the first that yields an
 * image. One source was not enough in practice: the single most likely
 * source for a kit page is also one of the most likely to refuse a
 * server-side request, and having nothing to fall back to meant one
 * uncooperative host cost the kit its art entirely.
 */
export async function saveBoxArt(sources: Array<string | null>): Promise<BoxArtResult> {
  const tried = sources.filter((s): s is string => Boolean(s));
  if (tried.length === 0) return { ok: false, reason: "No link to read box art from." };

  let lastReason = "No link to read box art from.";

  for (const source of tried) {
    const resolved = await resolveBoxArtUrl(source);
    if (!resolved.ok) {
      lastReason = resolved.reason;
      continue;
    }

    const stored = await storeImage(resolved.url);
    if (stored.ok) return stored;
    lastReason = stored.reason;
  }

  return { ok: false, reason: lastReason };
}

/** Downloads a direct image URL and puts it in Blob. */
async function storeImage(imageUrl: string): Promise<BoxArtResult> {
  // Checked before spending a download on an image that has nowhere to go.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    log("no-token", { image: imageUrl });
    return {
      ok: false,
      reason:
        "No Blob token is configured. Connect a Blob store in Vercel → Storage, then redeploy so BLOB_READ_WRITE_TOKEN reaches the running deployment.",
    };
  }

  const host = (() => {
    try {
      return new URL(imageUrl).host;
    } catch {
      return "that host";
    }
  })();

  try {
    const fetched = await safeFetch(imageUrl, "image/*", FETCH_TIMEOUT_MS);
    if (!fetched) {
      log("image-unreachable", { image: imageUrl });
      return { ok: false, reason: `Couldn't download the image from ${host}.` };
    }
    if (!fetched.response.ok) {
      await fetched.response.body?.cancel();
      log("image-not-ok", { image: imageUrl, status: fetched.response.status });
      return { ok: false, reason: describeStatus(fetched.response.status, host) };
    }

    const contentType = (fetched.response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const extension = EXTENSION_BY_CONTENT_TYPE.get(contentType);
    if (!extension) {
      await fetched.response.body?.cancel();
      log("image-wrong-type", { image: imageUrl, contentType });
      return { ok: false, reason: `What ${host} served back wasn't an image.` };
    }

    const bytes = await readCapped(fetched.response, MAX_BYTES);
    if (!bytes) {
      log("image-unreadable", { image: imageUrl });
      return { ok: false, reason: `Couldn't download the image from ${host}.` };
    }

    const blob = await put(`kits/${crypto.randomUUID()}${extension}`, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    log("stored", { image: imageUrl, bytes: bytes.byteLength, blob: blob.url });
    return { ok: true, url: blob.url };
  } catch (error) {
    log("store-threw", {
      image: imageUrl,
      error: error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error),
    });
    return { ok: false, reason: describeBlobError(error) };
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
