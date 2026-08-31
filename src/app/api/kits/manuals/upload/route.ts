import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { describeBlobError } from "@/lib/box-art";

/**
 * The manual upload fallback — docs/PLAN.md §6 Phase 4a, §4.3.
 *
 * Client-direct upload (`upload-token/route.ts`) is the primary path; this
 * route exists for when it fails — a network blip, a store that rejects the
 * client-token flow, anything. It's a plain server-side `put`, the same
 * shape as Phase 3's photo upload, which means it inherits that route's own
 * limit: Vercel's serverless functions cap a request body at roughly 4.5 MB.
 * Real manuals run 10–40 MB, so this path only ever covers a genuinely small
 * PDF — the UI says so plainly when it's the one that ran (docs/PLAN.md §7's
 * rule: every failure path returns a reason, never a silent guess).
 */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

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
    return jsonError("No file was attached.", 400);
  }
  if (file.size === 0) {
    return jsonError("That file came through empty — try again.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError(
      `That manual is ${(file.size / (1024 * 1024)).toFixed(1)} MB — too large for the standard upload path (4 MB). Direct upload to storage should handle a bigger file; if it keeps failing, try again on a different connection.`,
      413,
    );
  }

  const contentType = file.type.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/pdf") {
    return jsonError("That file isn't a PDF.", 415);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[manual-upload] BLOB_READ_WRITE_TOKEN is not set in this environment");
    return jsonError(
      "Manual storage isn't configured — BLOB_READ_WRITE_TOKEN is missing. Connect a Blob store in Vercel → Storage, then redeploy.",
      500,
    );
  }

  try {
    const blob = await put(`kits/manuals/${crypto.randomUUID()}.pdf`, file, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return NextResponse.json<UploadResponse>({ ok: true, url: blob.url });
  } catch (error) {
    console.error(
      "[manual-upload] put failed:",
      error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error),
    );
    return jsonError(describeBlobError(error), 502);
  }
}
