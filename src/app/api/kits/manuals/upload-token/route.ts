import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { MAX_MANUAL_UPLOAD_BYTES } from "@/domain/kit-manual";

/**
 * The client-direct upload's token route — docs/PLAN.md §6 Phase 4a, §4.3.
 *
 * Manual PDFs run 10–40 MB, well past Vercel's ~4.5 MB serverless request-body
 * limit, so the browser has to PUT straight to Blob's own API rather than
 * streaming through a function (the way Phase 3's photo upload does, which
 * gets away with it only because every photo is resized to a few hundred kB
 * client-side first). `upload()` from `@vercel/blob/client` fetches a
 * short-lived, constrained token from this route, then uploads directly.
 *
 * This route only *authorises* the upload — it never sees the file's bytes
 * and it does not write to the database. The `kit_manual` row is written by
 * a Server Action the client calls once `upload()` resolves (see
 * `createManualForKit` in `../../../(bench)/kits/actions.ts`), not from
 * `onUploadCompleted` below, which needs a publicly reachable callback URL
 * and never fires against a local dev server.
 */

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "That upload request didn't come through — try again." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: MAX_MANUAL_UPLOAD_BYTES,
        addRandomSuffix: false,
      }),
      // No onUploadCompleted — see the file comment. The Server Action the
      // client calls after upload() resolves is what writes the row.
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    // One structured log line per attempt (docs/PLAN.md §7's lesson: a
    // failure path that returns nothing readable cost two whole rounds of
    // guesswork on box art before it was fixed the same way).
    console.error(
      "[manual-upload-token] handleUpload failed:",
      error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error),
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't authorise that upload — try again." },
      { status: 400 },
    );
  }
}
