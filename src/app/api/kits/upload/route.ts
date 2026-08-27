import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { describeBlobError } from "@/lib/box-art";

/**
 * Photo upload behind `ManualKitDialog` — docs/PLAN.md §6 Phase 3.
 *
 * The browser posts the file here and this route puts it in Blob, rather
 * than the client-token dance `@vercel/blob/client`'s `upload()` does. That
 * pattern exists for genuinely large files: the browser PUTs straight to
 * Vercel's Blob API with a short-lived token, so nothing streams through a
 * function. It also meant a cross-origin request from this app's own domain,
 * which is where it fell over in practice — Vercel's API answered the upload
 * with a 400 carrying no `Access-Control-Allow-Origin`, so the browser only
 * ever reported an opaque CORS failure with nothing readable underneath it.
 *
 * None of that complexity was buying anything here. `ManualKitDialog`
 * resizes every photo to a card thumbnail before it leaves the browser, so
 * what arrives is a few hundred kB — comfortably inside a function's request
 * body limit, and small enough that streaming it through the server costs
 * nothing worth measuring. A route handler rather than a Server Action for
 * the same reason `/api/kits/resolve` is one: Server Action bodies are
 * capped at 1MB by default, and a file upload has no business living that
 * close to a limit it doesn't control.
 *
 * Every path but `/login` and `/api/login` sits behind the session cookie
 * check in `src/proxy.ts`, so this route needs no auth check of its own.
 */

/** Well under a serverless function's request body limit, and far above
 * anything `resizeImage` actually produces — this is a backstop against a
 * malformed request, not a real expectation. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Matches what `resizeImage` can emit plus the formats a browser will hand
 * over untouched if resizing ever gets skipped. A Map, not an object
 * literal, so a value like `constructor` can't match an inherited property. */
const EXTENSION_BY_CONTENT_TYPE = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

type UploadResponse = { ok: true; url: string } | { ok: false; error: string };

function jsonError(error: string, status: number) {
  return NextResponse.json<UploadResponse>({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  let file: unknown;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return jsonError("That upload didn't come through — try again.", 400);
  }

  if (!(file instanceof File)) {
    return jsonError("No photo was attached.", 400);
  }
  if (file.size === 0) {
    return jsonError("That photo came through empty — try again.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("That photo is too large.", 413);
  }

  const contentType = file.type.split(";")[0].trim().toLowerCase();
  const extension = EXTENSION_BY_CONTENT_TYPE.get(contentType);
  if (!extension) {
    return jsonError("That file isn't a JPEG, PNG or WebP image.", 415);
  }

  // Checked explicitly rather than left to `put` to discover: a store that was
  // never connected, or connected after the last deploy, is the single most
  // likely reason for an upload to fail here, and "the variable isn't set" is
  // a different job from "the token was refused".
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[upload] BLOB_READ_WRITE_TOKEN is not set in this environment");
    return jsonError(
      "Photo storage isn't configured — BLOB_READ_WRITE_TOKEN is missing. Connect a Blob store in Vercel → Storage, then redeploy.",
      500,
    );
  }

  try {
    const blob = await put(`kits/${crypto.randomUUID()}${extension}`, file, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return NextResponse.json<UploadResponse>({ ok: true, url: blob.url });
  } catch (error) {
    // The reason reaches the user, not just the log. This is a single-user app
    // whose user administers its own Vercel project, and a generic "try again"
    // on a store misconfiguration costs a whole debugging round trip for
    // something the SDK already identified exactly. The token never appears in
    // any of these — only whether it was accepted.
    console.error(
      "[upload] put failed:",
      error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error),
    );
    return jsonError(describeBlobError(error), 502);
  }
}
