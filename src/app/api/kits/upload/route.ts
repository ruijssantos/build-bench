import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * Token endpoint behind `ManualKitDialog`'s photo upload — docs/PLAN.md §6
 * Phase 3 edit feature. A route handler, not a Server Action: a photo from
 * the user's own camera roll can run well past the 1MB Server Action body
 * limit, so the browser's `upload()` call sends the bytes straight to Blob
 * and only asks this route for a short-lived token first (the same
 * client-upload pattern Next's own docs describe for large files).
 *
 * No `onUploadCompleted` — that webhook only fires once this app is actually
 * deployed on Vercel, never on localhost, so `ManualKitDialog` uses the
 * `PutBlobResult` its own `upload()` call already returns instead of relying
 * on a callback that wouldn't fire in development.
 *
 * Every path but `/login` and `/api/login` sits behind the session cookie
 * check in `src/proxy.ts`, so this route needs no auth check of its own.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        maximumSizeInBytes: 10 * 1024 * 1024,
        addRandomSuffix: false,
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
