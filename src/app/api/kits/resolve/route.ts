import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { KIT_CATEGORIES } from "@/domain/kit";

/**
 * Kit resolve — docs/PLAN.md §5.1 stage A, §2.4, §5.2.
 *
 * A route handler rather than a Server Action: this is a search, and
 * `src/app/api/` is where a search lives per docs/PLAN.md §4 ("only where a
 * Server Action doesn't fit — search, external callbacks, kit research's
 * staged calls"). Unlike `/api/paints/search`, every call here is a real,
 * paid ~10–20s round trip to Claude with web search — there is no local
 * index behind it — so this is submit-triggered from the client, never
 * per-keystroke.
 *
 * One request, one model call (plus the occasional `pause_turn` resume
 * below) — no `research_job` row. That table exists for the multi-stage
 * pipeline stages B and C land in Phase 6; stage A is a single call with
 * nothing to accumulate between requests.
 */

export const maxDuration = 60;

const CandidateSchema = z.object({
  brand: z.string(),
  kitNumber: z.string(),
  name: z.string(),
  scale: z.string(),
  category: z.enum(KIT_CATEGORIES),
  scalematesUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

/**
 * Capped at 10, not the 5 docs/PLAN.md §5.1 originally specified — the brief
 * for this phase asked for up to 10 ranked candidates, so the schema and
 * this comment both moved; see the PR description for the note on PLAN.md.
 */
const ResolveResultSchema = z.object({
  candidates: z.array(CandidateSchema).max(10),
});

const SYSTEM_PROMPT = `You resolve a scale-model kit search into real, purchasable kit records for a hobbyist's wishlist app. The query is either a kit number ("24345") or free text ("Tamiya Nissan GT-R").

Use web search to find real kits. Scalemates (scalemates.com) is the best single reference for brand, kit number, name, scale and category — prefer it as a source when you find a matching page there and use its URL as scalematesUrl. A clear box art photo from another retailer or the manufacturer's own site is fine for imageUrl if you can't confirm one on Scalemates.

Return up to 10 candidates, most likely match first. Only include kits you found real evidence for — never invent a kit number or name to pad the list. If nothing plausible turns up, return an empty candidates array; that is a normal, expected result, not a failure.

For each candidate:
- brand: the manufacturer, e.g. "Tamiya"
- kitNumber: the kit's model/box number as printed, e.g. "24345"
- name: the kit's subject, e.g. "Nissan Skyline GT-R (R34) V-Spec II"
- scale: e.g. "1:24" — this app is built around 1:24 scale car kits, so when a query is ambiguous about scale weight 1:24 releases higher, but report whatever scale the real kit you found actually is
- category: one of cars, motorcycles, aircraft, armour, ships, figures, other
- scalematesUrl: the kit's Scalemates page if you found one, else null
- imageUrl: a direct URL to a box art image if you found one, else null`;

type ResolveResponse =
  | { ok: true; candidates: z.infer<typeof ResolveResultSchema>["candidates"] }
  | { ok: false; error: string };

function jsonError(error: string, status = 200) {
  return NextResponse.json<ResolveResponse>({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("That search didn't come through — try again.", 400);
  }

  const rawQuery = (body as { query?: unknown } | null)?.query;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (!query) {
    return jsonError("Type a kit number or a name to search.", 400);
  }
  if (query.length > 200) {
    return jsonError("That search is a bit long — try trimming it.", 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("Kit search isn't set up yet — ANTHROPIC_API_KEY is missing. Add it by hand for now.");
  }

  const client = new Anthropic();
  const format = zodOutputFormat(ResolveResultSchema);
  const tools = [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 2 }];

  const requestParams = {
    model: "claude-sonnet-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "medium" as const, format },
    system: SYSTEM_PROMPT,
    tools,
  };

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: query }];

  try {
    let response = await client.messages.create({ ...requestParams, messages });

    // A long server-tool turn can pause rather than finish; an unhandled
    // pause silently truncates the answer (docs/PLAN.md §5.2). Resume by
    // feeding the paused assistant turn back, capped so a run that somehow
    // never settles can't loop forever.
    let resumes = 0;
    while (response.stop_reason === "pause_turn" && resumes < 3) {
      messages = [...messages, { role: "assistant", content: response.content }];
      response = await client.messages.create({ ...requestParams, messages });
      resumes++;
    }

    if (response.stop_reason === "refusal") {
      return jsonError("That search couldn't be completed — try rephrasing it, or add the kit by hand.");
    }

    // Web search errors return HTTP 200 with an error object in the result
    // block rather than throwing (docs/PLAN.md §5.2) — a success `content`
    // is an array, an error `content` is an object, so branch before
    // indexing. Not fatal on its own: Claude still answers with whatever it
    // found, which the empty-candidates path below already covers.
    const searchToolErrored = response.content.some(
      (block) => block.type === "web_search_tool_result" && !Array.isArray(block.content),
    );

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock) {
      return jsonError(
        searchToolErrored
          ? "Search hit a problem partway through — try again, or add the kit by hand."
          : "That search didn't return a result — try again.",
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(textBlock.text);
    } catch {
      return jsonError("Search returned something unexpected — try again.");
    }

    const result = ResolveResultSchema.safeParse(parsedJson);
    if (!result.success) {
      return jsonError("Search returned something unexpected — try again.");
    }

    return NextResponse.json<ResolveResponse>({ ok: true, candidates: result.data.candidates });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return jsonError("Kit search isn't set up correctly — check the ANTHROPIC_API_KEY value.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      return jsonError("Kit search is rate-limited right now — try again in a moment.");
    }
    if (error instanceof Anthropic.APIError) {
      return jsonError("Kit search hit a problem — try again, or add the kit by hand.");
    }
    return jsonError("Kit search hit a problem — try again, or add the kit by hand.");
  }
}
