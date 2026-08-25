import { put } from "@vercel/blob";

/**
 * Box art, fetched once at save time — docs/PLAN.md §2.4, §4.3. A kit's
 * `image_url` is never a Scalemates (or anywhere else) hotlink: this is the
 * one place that boundary is crossed, and it crosses it exactly once per
 * kit, copying the bytes into Vercel Blob and handing back that URL instead.
 *
 * Deliberately permissive about failure. The source is whatever a Claude web
 * search turned up (§5.1 stage A) — it can 404, redirect somewhere odd, or
 * turn out not to be an image at all — and none of that should stop the kit
 * itself from saving. `null` here just means the saved kit shows without box
 * art, the same as a manually-entered one.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

export async function saveBoxArt(sourceUrl: string | null): Promise<string | null> {
  if (!sourceUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  try {
    const response = await fetch(parsed, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "image/*" },
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
    if (!extension) return null;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

    const blob = await put(`kits/${crypto.randomUUID()}${extension}`, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  } catch {
    return null;
  }
}
