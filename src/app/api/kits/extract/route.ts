import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { updateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { findKitManualById, markManualPaintsExtracted } from "@/db/repositories/kit-manuals";
import { KIT_REQUIREMENTS_TAG, replaceManualPaintRequirements } from "@/db/repositories/kit-paint-requirements";
import { kitTag } from "@/db/repositories/kits";
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
 */

export const maxDuration = 300;

const MAX_RESUMES = 3;

/** The Anthropic request ceiling is 32 MB and base64 inflates a file by
 * ~33%, so a raw PDF has to stay well under that once the rest of the
 * request (system prompt, schema) is added. 20 MB raw → ~27 MB encoded,
 * comfortable headroom. A manual over this still stores and views fine; it
 * just can't auto-extract. */
const MAX_EXTRACTION_PDF_BYTES = 20 * 1024 * 1024;

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

  if (manual.sizeBytes && manual.sizeBytes > MAX_EXTRACTION_PDF_BYTES) {
    return jsonError(
      `This manual is ${(manual.sizeBytes / (1024 * 1024)).toFixed(1)} MB — paint extraction needs the PDF under ~20 MB (the model's request limit, once base64 encoding inflates it). It's still stored and viewable; extraction just can't run on it.`,
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("Paint extraction isn't set up yet — ANTHROPIC_API_KEY is missing.");
  }

  const fetched = await safeFetch(manual.blobUrl, "application/pdf", FETCH_TIMEOUT_MS);
  if (!fetched) {
    return jsonError("Couldn't reach the stored manual — try again.");
  }
  const bytes = await readCapped(fetched.response, MAX_EXTRACTION_PDF_BYTES);
  if (!bytes) {
    return jsonError(
      "This manual is too large for paint extraction (over ~20 MB once base64-encoded) or couldn't be read. It's still stored and viewable.",
    );
  }

  const client = new Anthropic();

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
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: bytes.toString("base64") },
          },
          { type: "text" as const, text: "Extract the paint list from this manual." },
        ],
      },
    ],
  };

  let messages: Anthropic.MessageParam[] = requestParams.messages;

  try {
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

    updateTag(kitTag(kitId as number));
    updateTag(KIT_REQUIREMENTS_TAG);

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
  }
}
