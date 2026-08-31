import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { findKitManualById, markManualPaintsExtracted } from "@/db/repositories/kit-manuals";
import { KIT_REQUIREMENTS_TAG, replaceManualPaintRequirements } from "@/db/repositories/kit-paint-requirements";
import { kitTag } from "@/db/repositories/kits";
import { MAX_MANUAL_UPLOAD_BYTES } from "@/domain/kit-manual";
import { normalizeExtractedPaints, PaintExtractionResultSchema } from "@/domain/kit-paint-extraction";
import { readCapped, safeFetch } from "@/lib/box-art";

/**
 * Paint extraction — docs/PLAN.md §6 Phase 4a, §4.3, §5.2.
 *
 * An explicit "Extract paint list" action per manual, never automatic on
 * upload. A route rather than a Server Action for the same reason
 * `/api/kits/resolve` is one (docs/PLAN.md §4): this is a real, possibly
 * long, external call, and Server Action bodies aren't the right shape for
 * that. Unlike resolve, this route also does the write — there's no further
 * user input between "Claude answered" and "save it" the way a search result
 * needs Save clicked, so shipping the full parsed list back to the client
 * purely to ship it straight back in a second request would just be a slower
 * round trip for the same outcome. See docs/PLAN.md §7 for that call.
 *
 * Mechanics copied from `resolve/route.ts`, which got them right first: the
 * `pause_turn` resume loop, typed `Anthropic.*Error` branches, `{ ok: false,
 * error }` at HTTP 200 for every expected failure. No web search tool is
 * declared here (this reads an attached document, not the web), so there is
 * no server-tool-error content shape to branch on the way resolve's web
 * search does — that check doesn't apply to this call.
 *
 * The PDF goes to Claude through the Files API, not inlined as base64 in the
 * request body. That used to be the only option, and it capped what could be
 * extracted well below what could be stored (docs/PLAN.md §4.3, §7) — base64
 * inflates a file by ~33% and the Messages API request ceiling is 32 MB, so a
 * raw PDF had to stay under ~20 MB even though uploads allow 45 MB. The Files
 * API's own ceiling is 500 MB, comfortably past `MAX_MANUAL_UPLOAD_BYTES`, so
 * this route can now extract anything it can store. The uploaded file is
 * deleted again once the run finishes (`finally`, below) — it only exists to
 * make this one request's document reference resolvable, not as a second
 * copy of the manual worth keeping around.
 */

export const maxDuration = 300;

const MAX_RESUMES = 3;

const FETCH_TIMEOUT_MS = 20_000;

const SYSTEM_PROMPT = `You extract every paint callout from a scale-model kit's instruction manual, for a hobbyist app that checks them against the paints already on a shelf.

Read the attached PDF. For every distinct paint callout you find — usually printed next to a part or a colour swatch, as a code and/or a name, e.g. "X-11 CHROME SILVER", "13. Mr. Color C8 Silver", or just a paint name with no code at all — return one entry:
- rawLabel: the callout exactly as printed, including any code, name and number. Don't paraphrase or normalise it.
- codeGuess: your best guess at just the paint's code token within that label (e.g. "X-11", "XF-64", "TS-8"), if the label plausibly contains one. null if it doesn't — a Mr. Color, Vallejo or other-brand callout with no Tamiya-style code, or a callout with no code at all, is completely normal. Never invent one.
- partHint: which part or area it's for, if the manual states it (e.g. "body", "chassis", "interior"). null if not stated.

Include every distinct callout once, even if the manual repeats it across several parts. Small print and scanned diagrams are common in these manuals — read carefully; a wrong code sends someone to the shop for the wrong bottle of paint. If the manual has no paint callouts at all (a decal sheet, say), return an empty requirements array — that is a normal, expected result, not a failure.`;

interface ExtractResponse {
  ok: boolean;
  ownedCount?: number;
  requirementCount?: number;
  error?: string;
}

function jsonError(error: string, status = 200) {
  return NextResponse.json<ExtractResponse>({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("That request didn't come through — try again.", 400);
  }

  const { manualId, kitId } = (body as { manualId?: unknown; kitId?: unknown } | null) ?? {};
  if (!Number.isInteger(manualId) || !Number.isInteger(kitId)) {
    return jsonError("Missing manual — try again.", 400);
  }

  const manual = await findKitManualById(manualId as number, kitId as number);
  if (!manual) {
    return jsonError("That manual is no longer on this kit.");
  }

  if (manual.sizeBytes && manual.sizeBytes > MAX_MANUAL_UPLOAD_BYTES) {
    return jsonError(
      `This manual is ${(manual.sizeBytes / (1024 * 1024)).toFixed(1)} MB, over the ${MAX_MANUAL_UPLOAD_BYTES / (1024 * 1024)} MB storage limit — it shouldn't be possible to have uploaded it. Re-upload it and try again.`,
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("Paint extraction isn't set up yet — ANTHROPIC_API_KEY is missing.");
  }

  const fetched = await safeFetch(manual.blobUrl, "application/pdf", FETCH_TIMEOUT_MS);
  if (!fetched) {
    return jsonError("Couldn't reach the stored manual — try again.");
  }
  // Checked before the body is read, the same as every other `safeFetch`
  // caller in `box-art.ts`: `safeFetch` hands back whatever the host answered,
  // status and all. Without this, a 404 or 403 from Blob (a deleted object, a
  // store that lost its token) would have its HTML error page base64'd and
  // posted to the model as `application/pdf` — burning a paid Opus call to
  // learn nothing, and reporting the generic failure rather than the real one.
  if (!fetched.response.ok) {
    await fetched.response.body?.cancel();
    console.error(`[extract] manual fetch failed: HTTP ${fetched.response.status} for manual ${manual.id}`);
    return jsonError(
      `Couldn't read the stored manual — storage answered HTTP ${fetched.response.status}. If it was removed, re-upload it.`,
    );
  }
  const bytes = await readCapped(fetched.response, MAX_MANUAL_UPLOAD_BYTES);
  if (!bytes) {
    return jsonError("Couldn't read the stored manual — try again.");
  }

  const client = new Anthropic();

  let uploadedFileId: string | null = null;
  try {
    const uploaded = await client.files.upload({
      file: await toFile(bytes, manual.filename ?? "manual.pdf", { type: "application/pdf" }),
    });
    uploadedFileId = uploaded.id;

    const requestParams = {
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" as const },
      output_config: { effort: "high" as const, format: zodOutputFormat(PaintExtractionResultSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user" as const,
          content: [
            {
              type: "document" as const,
              source: { type: "file" as const, file_id: uploadedFileId },
            },
            { type: "text" as const, text: "Extract the paint list from this manual." },
          ],
        },
      ],
    };

    let messages: Anthropic.MessageParam[] = requestParams.messages;

    let stream = client.messages.stream({ ...requestParams, messages });
    let response = await stream.finalMessage();

    // A long turn can pause rather than finish; an unhandled pause silently
    // truncates the answer (docs/PLAN.md §5.2). Resume by feeding the paused
    // assistant turn back — mirrors resolve/route.ts.
    let resumes = 0;
    while (response.stop_reason === "pause_turn" && resumes < MAX_RESUMES) {
      messages = [...messages, { role: "assistant", content: response.content }];
      stream = client.messages.stream({ ...requestParams, messages });
      response = await stream.finalMessage();
      resumes++;
    }

    if (response.stop_reason === "refusal") {
      return jsonError("That extraction couldn't be completed — try again.");
    }
    if (response.stop_reason === "pause_turn") {
      return jsonError("That extraction ran long and didn't finish — try again.");
    }
    if (response.stop_reason === "max_tokens") {
      return jsonError("This manual's paint list is longer than extraction could fit — try again.");
    }

    if (!response.parsed_output) {
      return jsonError("Extraction returned something unexpected — try again.");
    }

    const requirements = normalizeExtractedPaints(response.parsed_output);

    await replaceManualPaintRequirements(
      kitId as number,
      manualId as number,
      requirements.map((r) => ({ rawLabel: r.rawLabel, paintCode: r.paintCode, partHint: r.partHint })),
    );
    await markManualPaintsExtracted(manualId as number, kitId as number);

    // `revalidateTag`, not `updateTag`: this is a Route Handler, and
    // `updateTag` throws there by design (it exists for read-your-own-writes
    // inside a Server Action). That throw would land in this function's own
    // catch below — so every *successful* extraction reported failure while
    // the caches went stale. `"max"` expires immediately, which is what a
    // just-written paint list needs.
    revalidateTag(kitTag(kitId as number), "max");
    revalidateTag(KIT_REQUIREMENTS_TAG, "max");

    return NextResponse.json<ExtractResponse>({
      ok: true,
      requirementCount: requirements.length,
      ownedCount: requirements.filter((r) => r.paintCode).length,
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return jsonError("Paint extraction isn't set up correctly — check the ANTHROPIC_API_KEY value.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      return jsonError("Paint extraction is rate-limited right now — try again in a moment.");
    }
    if (error instanceof Anthropic.APIError) {
      return jsonError("Paint extraction hit a problem — try again.");
    }
    return jsonError("Paint extraction hit a problem — try again.");
  } finally {
    // Best-effort: a file left behind counts against the org's storage quota
    // but never blocks anything, so a delete failure here shouldn't turn a
    // real extraction result (success or a reported error) into a generic
    // one.
    if (uploadedFileId) {
      await client.files.delete(uploadedFileId).catch((error: unknown) => {
        console.error(`[extract] failed to delete uploaded file ${uploadedFileId}:`, error);
      });
    }
  }
}
