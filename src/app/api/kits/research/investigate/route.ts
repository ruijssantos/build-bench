import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";

import { createResearchJob, recordStage } from "@/db/repositories/kit-research";
import { getKitById } from "@/db/repositories/kits";
import { isStashStatus } from "@/domain/kit";
import { describeAnthropicError, logAnthropicError } from "@/lib/anthropic-errors";

/**
 * Kit research, stage B — docs/PLAN.md §5.1, §5.4, §6 Phase 7.
 *
 * The expensive one: Opus 5 with web search and web fetch, reading forum
 * threads and review blogs about one specific kit and writing up what builders
 * actually say about it. §5.1 also listed "a build video" among what this
 * stage finds; it doesn't, because the kit page has had its own YouTube search
 * since Phase 4a and a second video link on the same screen is a duplicate
 * either way — so this stops short of paying to look for one. Free-form prose **with citations**, not structured
 * output, because structured outputs and citations are mutually exclusive
 * (§5.2) and citations are the entire basis of §5.4's trust rules — a claim
 * with no source doesn't get shown at all.
 *
 * The typed JSON comes from stage C, a second, cheap call over this one's
 * prose. Splitting them is what makes a failure survivable: stage C failing
 * costs cents to retry, where re-running this costs the whole ~€0.20–0.45
 * (§5.3) and two to three minutes of the owner's afternoon.
 *
 * Mechanics inherited from `../../resolve/route.ts`, which established them:
 * the `pause_turn` resume loop, the structural web-search-error check, typed
 * `Anthropic.*Error` branches through `describeAnthropicError`, and `{ ok:
 * false, error }` at HTTP 200 so the client only ever branches on `data.ok`.
 *
 * No `fallbacks` parameter. The SDK offers server-side refusal fallbacks on
 * Opus 5, but a refusal on "what do builders say about this Tamiya kit" is not
 * a failure mode this app has; `stop_reason: "refusal"` is handled explicitly
 * below instead, the same way `extract/route.ts` handles it. Revisit if one
 * ever actually turns up.
 */

/** §1.2's ceiling. Stage B is budgeted at 60–180s (§5.1) and can resume up to
 * `MAX_RESUMES` times on top of that, so it gets the full 300s. */
export const maxDuration = 300;

const MAX_RESUMES = 3;

/** §5.1's number. Six searches is enough to find a build thread, a review and
 * a video for a kit that has them, and a kit that has none of those isn't
 * helped by a seventh. */
const MAX_SEARCHES = 6;

const MAX_FETCHES = 4;

const SYSTEM_PROMPT = `You research a specific scale-model kit for a hobbyist about to build it. Everything you report will be shown to that person next to a link to where it came from, so a claim you cannot source is a claim not worth making.

Search for what builders say about this exact kit — build threads, forum posts, review blogs. Scalemates is a good index but blocks automated fetching, so prefer forums (Britmodeller, Model Cars Magazine, Scale Auto, FineScale, Reddit r/modelmakers), review sites, and manufacturers' own pages.

Report, in prose:

1. **Difficulty** — beginner, intermediate or advanced, as the consensus across what you actually read. One sentence on why. If sources genuinely disagree, say so rather than picking a side.

2. **Fit issues** — specific problems builders hit with this kit. "The bonnet sits proud unless the firewall is sanded" is useful; "some parts need cleanup" is true of every kit ever made and is not. Give each one a severity: minor, moderate or major. Skip this entirely if the kit has a reputation for going together well — an empty list is a real and welcome answer, not a failed search.

3. **Tips** — build advice as distinct from defects. Technique, ordering, a paint that works better than the box calls for, a tool that makes one step tractable. Categorise each as prep, paint, decals, assembly, tools or reference.

That is the whole job. Don't go looking for a build video or for the instructions online: the app already links out to YouTube and to Scalemates by itself, and has the uploaded manual besides. Spend the searches on what builders said instead.

For every claim, write the full URL you got it from inline, right next to the claim, as plain text starting with https:// — not a footnote marker, not a bare domain, not a markdown link with the URL hidden behind text. A later step reads those URLs straight out of your prose and drops any claim it cannot find one for, so a claim whose URL is missing or abbreviated is a claim that gets thrown away.

A claim you found in only one place is fine — say that it was one builder's experience. What is not fine is presenting something you inferred, or know generally about kits of this type, as though a source said it about this kit. If you found very little, report very little; a short honest answer is more useful than a padded one, because the person reading it is about to spend a weekend on this model.`;

type InvestigateResponse = { ok: true; jobId: string } | { ok: false; error: string };

function jsonError(error: string, status = 200) {
  return NextResponse.json<InvestigateResponse>({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("That request didn't come through — try again.", 400);
  }

  const { kitId } = (body as { kitId?: unknown } | null) ?? {};
  if (!Number.isInteger(kitId)) {
    return jsonError("Missing kit — try again.", 400);
  }

  const kit = await getKitById(kitId as number);
  // Same gate as the detail page itself: research belongs to a kit you own.
  // A wishlist row reads back fine from this table (§3.3) and is deliberately
  // not researchable — you research a kit to build it, not to want it.
  if (!kit || !isStashStatus(kit.status)) {
    return jsonError("That kit is no longer in the stash.");
  }
  if (!kit.name) {
    return jsonError("Give this kit a name first — there's nothing to search for otherwise.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("Kit research isn't set up yet — ANTHROPIC_API_KEY is missing.");
  }

  const query = [kit.brand, kit.kitNumber, kit.name, kit.scale].filter(Boolean).join(" ");
  const jobId = await createResearchJob(kit.id, query);
  const startedAt = Date.now();

  const client = new Anthropic();

  const requestParams = {
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "high" as const },
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: "web_search_20260209" as const,
        name: "web_search" as const,
        max_uses: MAX_SEARCHES,
        // `["direct"]`, not the default. On `web_search_20260209` and later
        // `allowed_callers` defaults to `["code_execution_20260120"]` — the
        // search runs *inside* code execution ("dynamic filtering"), which
        // filters results down before they reach the model and saves tokens.
        //
        // That default broke this route in production and is worth spelling
        // out. Two things change under dynamic filtering: the
        // `web_search_tool_result` blocks arrive **nested inside the code
        // execution result**, not at the top level of `response.content`; and
        // the model reads filtered code output rather than search results it
        // is citing directly, so the `web_search_result_location` citations
        // this feature is built on largely stop appearing. Everything
        // downstream — the source list, §5.4's whole trust surface — is
        // downstream of those citations.
        //
        // Direct search costs more input tokens because every result lands in
        // context. That is the right trade for a once-per-kit call whose
        // entire output is claims-with-sources.
        allowed_callers: ["direct" as const],
      },
      {
        type: "web_fetch_20260209" as const,
        name: "web_fetch" as const,
        max_uses: MAX_FETCHES,
        // Same reasoning, same default, same fix.
        allowed_callers: ["direct" as const],
        // Unlike web search — where citations are always on — web fetch's are
        // opt-in and off by default.
        citations: { enabled: true },
      },
    ],
  };

  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Research this kit: ${query}` },
  ];

  try {
    // Streamed because this runs for minutes at a stretch — a non-streaming
    // request that long risks the SDK's own HTTP timeout (§5.2). Nothing
    // consumes the events; `finalMessage()` is just the safe way to wait.
    let response = await client.messages.stream({ ...requestParams, messages }).finalMessage();

    let resumes = 0;
    while (response.stop_reason === "pause_turn" && resumes < MAX_RESUMES) {
      messages = [...messages, { role: "assistant", content: response.content }];
      response = await client.messages.stream({ ...requestParams, messages }).finalMessage();
      resumes++;
    }

    const { prose, sources } = collectProseAndSources(response);

    /** Records the failure — but keeps whatever prose the run did produce.
     * A truncated or paused write-up is still most of what was paid for, and
     * leaving it on the job means the retry can go straight to stage C. */
    const failed = async (error: string) => {
      await recordStage(
        jobId,
        "investigate",
        { ok: false, error, durationMs: Date.now() - startedAt },
        prose ? { prose, sources, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : undefined,
      );
      return jsonError(error);
    };

    if (response.stop_reason === "refusal") {
      return failed("That research couldn't be completed — try again.");
    }
    if (response.stop_reason === "pause_turn") {
      return failed("Research ran long and didn't finish — try again.");
    }
    if (response.stop_reason === "max_tokens") {
      return failed("Research returned more than it could fit — try again.");
    }

    // Web-tool errors arrive as HTTP 200 with an error object where a result
    // list belongs (§5.2), never as a throw. A success `content` is an array,
    // an error `content` is an object — branch before indexing. This only sees
    // top-level blocks, which is correct *because* `allowed_callers` is
    // `["direct"]` above; under the dynamic-filtering default these blocks are
    // nested inside a code execution result and this check would find nothing.
    const searchErrored = response.content.some(
      (block) =>
        (block.type === "web_search_tool_result" || block.type === "web_fetch_tool_result") &&
        !Array.isArray(block.content) &&
        typeof block.content === "object" &&
        block.content !== null &&
        "error_code" in block.content,
    );

    if (!prose.trim()) {
      return failed(
        searchErrored
          ? "Research hit a problem partway through — try again."
          : "Research came back empty — try again.",
      );
    }
    // No `sources.length === 0` gate here any more, and its removal is the
    // point of this whole revision. It used to fail the run outright on the
    // reasoning that §5.4 needs a source per claim, so a citation-less write-up
    // was worthless — but that threw away the *prose*, which is where the URLs
    // actually are (the prompt asks for them inline). Two real runs died that
    // way after three minutes and ~€0.30 each, reporting "nothing it could
    // cite" about kits that had plenty written about them.
    //
    // §5.4 is not enforced here and never needed to be: `normalizeResearch`
    // drops any claim whose `sourceUrl` doesn't parse, so an genuinely
    // unsourceable run still ends with nothing shown — just after a cheap
    // stage C rather than instead of one. `sources` is an aid handed to stage
    // C, not a gate.
    if (sources.length === 0) {
      console.warn(`[kits/research/investigate] no sources collected for job ${jobId} — stage C will work from the prose alone`);
    }

    await recordStage(
      jobId,
      "investigate",
      {
        ok: true,
        durationMs: Date.now() - startedAt,
        tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      {
        prose,
        sources,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    );

    return NextResponse.json<InvestigateResponse>({ ok: true, jobId });
  } catch (error) {
    logAnthropicError("kits/research/investigate", error);
    const message = describeAnthropicError(error, "Kit research");
    await recordStage(jobId, "investigate", {
      ok: false,
      error: message,
      durationMs: Date.now() - startedAt,
    }).catch(() => {
      // The job row is bookkeeping; failing to update it must not replace a
      // real, specific API error with a database one.
    });
    return jsonError(message);
  }
}

/**
 * Pulls out what stage C needs: the write-up, and every URL the model actually
 * cited.
 *
 * The citations are collected here rather than left for stage C to re-derive
 * from the prose, because they are *structured* at this point — the API
 * attaches them to the text blocks that used them — and become plain text the
 * moment the prose is handed on. `sources` is what `consensusLine` counts and
 * what stage C is told to draw its `sourceUrl` values from.
 */
function collectProseAndSources(response: Anthropic.Message): { prose: string; sources: string[] } {
  const parts: string[] = [];
  const sources = new Set<string>();

  for (const block of response.content) {
    if (block.type === "text") {
      parts.push(block.text);
      for (const citation of block.citations ?? []) {
        // The citation union spans several location types and only the web
        // ones carry a URL — checked structurally rather than by naming each
        // member, so a new citation type doesn't break this loop.
        if ("url" in citation && typeof citation.url === "string") {
          sources.add(citation.url);
        }
      }
      continue;
    }
    collectUrlsFromBlock(block, sources);
  }

  const prose = parts.join("\n\n").trim();
  // Last resort, and in practice a productive one: the system prompt asks for
  // the URL inline next to each claim, so the prose is full of them even on a
  // turn that produced no citation objects at all.
  for (const url of prose.match(/https?:\/\/[^\s<>"')\]]+/g) ?? []) {
    sources.add(url.replace(/[.,;:]+$/, ""));
  }

  return { prose, sources: [...sources] };
}

/**
 * Every URL anywhere in a non-text block, however deeply nested.
 *
 * Written as a structural walk rather than as `if (block.type === …)` against
 * each result shape, because the shapes are not stable ground: a
 * `web_search_tool_result`'s `content` is a list of results on success and a
 * single error object on failure; a `web_fetch_tool_result`'s is one object;
 * and under dynamic filtering both arrive *nested inside* a code execution
 * result rather than at the top level (see `allowed_callers` above). This
 * route already lost two paid runs to assuming one of those shapes. Walking
 * for `url` keys costs nothing and survives the next shape change too.
 */
function collectUrlsFromBlock(value: unknown, sources: Set<string>, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const entry of value) collectUrlsFromBlock(entry, sources, depth + 1);
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === "url" && typeof entry === "string" && /^https?:\/\//.test(entry)) {
      sources.add(entry);
    } else if (typeof entry === "object") {
      collectUrlsFromBlock(entry, sources, depth + 1);
    }
  }
}
