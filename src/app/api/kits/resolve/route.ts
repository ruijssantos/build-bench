import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse, type NextRequest } from "next/server";

import { KIT_CATEGORIES } from "@/domain/kit";
import {
  MAX_CANDIDATES,
  normalizeCandidates,
  ResolveResultSchema,
  type KitCandidate,
} from "@/domain/kit-candidate";
import { resolveBoxArtUrl } from "@/lib/box-art";

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

/**
 * §1.2's ceiling, not a smaller guess: this handler can make up to four
 * sequential model calls (the first, plus `MAX_RESUMES` pause resumes) at
 * ~10–20s each, so a 60s cap could kill a turn the user has already been
 * billed for. §5.1 budgets each stage the full 300s.
 */
export const maxDuration = 300;

/** Each resume is another paid call; three is enough for a genuinely long
 * search turn and short of anything that could spin. */
const MAX_RESUMES = 3;

/** Tighter than `box-art.ts`'s own default: these run after the user has
 * already waited out the model call, so a slow host gets dropped rather than
 * held onto. A candidate whose art doesn't resolve in time simply shows the
 * fallback glyph — the same state it had before any of this existed. */
const ART_TIMEOUT_MS = 6_000;

/**
 * Fills in each candidate's `imageUrl` from its own page.
 *
 * The model is asked for a direct image URL and usually can't produce one —
 * web search sees page text, not image files — so before this step almost
 * every candidate arrived with `imageUrl: null` and every result card
 * rendered the empty-box glyph. `resolveBoxArtUrl` reads the kit page's
 * Open Graph image instead, which is a real direct URL that exists to be
 * embedded elsewhere.
 *
 * All candidates at once, and `allSettled` throughout: box art is decoration
 * on a search result, so one host that hangs or throws must not cost the
 * user the search they already paid for.
 */
async function withResolvedArt(candidates: KitCandidate[]): Promise<KitCandidate[]> {
  const resolved = await Promise.allSettled(
    candidates.map((candidate) =>
      resolveBoxArtUrl(candidate.imageUrl ?? candidate.scalematesUrl, ART_TIMEOUT_MS),
    ),
  );

  return candidates.map((candidate, i) => {
    const outcome = resolved[i];
    const imageUrl = outcome.status === "fulfilled" ? outcome.value : null;
    return { ...candidate, imageUrl: imageUrl ?? candidate.imageUrl };
  });
}

const SYSTEM_PROMPT = `You resolve a scale-model kit search into real, purchasable kit records for a hobbyist's wishlist app. The query is either a kit number ("24345") or free text ("Tamiya Nissan GT-R").

Use web search to find real kits. Scalemates (scalemates.com) is the best single reference for brand, kit number, name, scale and category — prefer it as a source when you find a matching page there and use its URL as scalematesUrl.

Getting scalematesUrl right matters more than you might expect: the app reads the box art off whatever page you point it at, so a candidate with a good page URL ends up with a picture even when you never see an image yourself. If there is no Scalemates page, put the best product page you did find there — a retailer listing or the manufacturer's own page for that exact kit is fine.

Return at most ${MAX_CANDIDATES} candidates, most likely match first. Only include kits you found real evidence for — never invent a kit number or name to pad the list. If nothing plausible turns up, return an empty candidates array; that is a normal, expected result, not a failure.

For each candidate:
- brand: the manufacturer, e.g. "Tamiya"
- kitNumber: the kit's model/box number as printed, e.g. "24345"
- name: the kit's subject, e.g. "Nissan Skyline GT-R (R34) V-Spec II"
- scale: e.g. "1:24" — this app is built around 1:24 scale car kits, so when a query is ambiguous about scale weight 1:24 releases higher, but report whatever scale the real kit you found actually is
- category: exactly one of ${KIT_CATEGORIES.join(", ")} — use these spellings verbatim
- scalematesUrl: the kit's Scalemates page, or failing that the best product page you found for this exact kit; null only if you genuinely found no page for it
- imageUrl: a direct URL to a box art image file if you happen to have one, else null — null is completely fine and expected, since the app can read the picture off scalematesUrl by itself. Never guess or construct an image URL to fill this in.`;

type ResolveResponse = { ok: true; candidates: KitCandidate[] } | { ok: false; error: string };

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

  // `messages.parse` + `zodOutputFormat` is the shape docs/PLAN.md §5.2
  // specifies for this pipeline: the SDK validates the model's JSON against
  // the schema and hands back `parsed_output`, so there is no hand-rolled
  // JSON.parse here to drift from what stages B and C will do in Phase 6.
  const requestParams = {
    model: "claude-sonnet-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "medium" as const, format: zodOutputFormat(ResolveResultSchema) },
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 2 }],
  };

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: query }];

  try {
    let response = await client.messages.parse({ ...requestParams, messages });

    // A long server-tool turn can pause rather than finish; an unhandled
    // pause silently truncates the answer (docs/PLAN.md §5.2). Resume by
    // feeding the paused assistant turn back.
    let resumes = 0;
    while (response.stop_reason === "pause_turn" && resumes < MAX_RESUMES) {
      messages = [...messages, { role: "assistant", content: response.content }];
      response = await client.messages.parse({ ...requestParams, messages });
      resumes++;
    }

    if (response.stop_reason === "refusal") {
      return jsonError("That search couldn't be completed — try rephrasing it, or add the kit by hand.");
    }

    // Both of these leave the answer knowingly incomplete, and both used to
    // fall through to the parse and surface as "returned something
    // unexpected" — indistinguishable from a genuinely malformed reply, in
    // the logs as well as the UI.
    if (response.stop_reason === "pause_turn") {
      return jsonError("That search ran long and didn't finish — try again, or add the kit by hand.");
    }
    if (response.stop_reason === "max_tokens") {
      return jsonError("That search returned more than it could fit — try a more specific query.");
    }

    // Web search errors return HTTP 200 with an error object in the result
    // block rather than throwing (docs/PLAN.md §5.2) — a success `content`
    // is an array, an error `content` is an object, so branch before
    // indexing. Not fatal on its own: Claude still answers with whatever it
    // found, which the empty-candidates path already covers.
    const searchToolErrored = response.content.some(
      (block) => block.type === "web_search_tool_result" && !Array.isArray(block.content),
    );

    if (!response.parsed_output) {
      return jsonError(
        searchToolErrored
          ? "Search hit a problem partway through — try again, or add the kit by hand."
          : "Search returned something unexpected — try again.",
      );
    }

    // Coercion, not rejection: the API enforces neither the category enum nor
    // the candidate cap, so `normalizeCandidates` does — see the note in
    // `src/domain/kit-candidate.ts` for why rejecting here threw away whole
    // paid searches over one off-vocabulary word.
    return NextResponse.json<ResolveResponse>({
      ok: true,
      candidates: await withResolvedArt(normalizeCandidates(response.parsed_output)),
    });
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
