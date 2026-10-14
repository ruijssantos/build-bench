import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidateTag } from "next/cache";

import {
  findUpgradesJobPartial,
  recordStage,
  replaceKitUpgrades,
  type UpgradesJobPartial,
} from "@/db/repositories/kit-upgrades";
import { findKitById, kitTag, type KitRow } from "@/db/repositories/kits";
import { spotmodelSearchUrl } from "@/domain/kit-references";
import {
  addUsage,
  formatCost,
  KitUpgradesSchema,
  NO_USAGE,
  normalizeUpgrades,
  runCostUsd,
  type RunUsage,
} from "@/domain/kit-upgrades";
import { describeAnthropicError, logAnthropicError, webToolErrored } from "@/lib/anthropic-errors";
import type { Result } from "@/lib/result";

/**
 * The upgrades search — aftermarket parts made for one kit. docs/PLAN.md §5.1.
 *
 * Two stages, as the research it replaced had, and for the same reasons:
 *
 *   B  web search + web fetch, writing up what exists **with citations** —
 *      citations and structured output are mutually exclusive (§5.2), and the
 *      sources are the whole trust surface (§5.4);
 *   C  that write-up into typed rows, no web tools, cheap.
 *
 * What changed is where it runs. These were two route handlers the kit page
 * called in turn; now the search starts by itself whenever a kit is added, so
 * it runs on the server, in `after()`, with nobody waiting on the response.
 * The split still pays: a failed stage C is retried against the job's saved
 * write-up for cents, without buying stage B again.
 *
 * Every outcome lands on the `research_job` row — the stage it reached, the
 * reason it failed, what each call cost — because no client is listening.
 * The kit page reads that row; a run that dies without writing is caught by
 * `upgradesJobState`'s stall rule rather than spinning forever.
 */

const MODEL = "claude-sonnet-5";

/** Stage B's server-side tool loop can pause; each resume re-sends the
 * conversation, so this is a cost ceiling as much as a time one. */
const MAX_RESUMES = 2;

/**
 * Searches are billed per call and every result stays in context, re-billed
 * on each later iteration of the loop — the effect that made the first
 * research run cost $1.60 (§5.3). Three is enough to find the makers'
 * listings; the Spotmodel fetch below does most of the work besides.
 */
const MAX_SEARCHES = 3;
const MAX_FETCHES = 2;
const MAX_FETCH_TOKENS = 6000;

const INVESTIGATE_PROMPT = `You find aftermarket upgrade parts made for one specific scale-model kit, for a hobbyist about to build it — detail-up sets, photo-etch, alternative decal sheets, replacement wheels, resin parts, masks, transkits.

Only parts made for THIS kit. A part qualifies when its maker or a shop lists it for this kit — by the kit's brand and number, or as "for <brand> 1/24 <subject>" matching this kit. Generic parts that would merely fit (universal seatbelts, a set of 1/24 rally wheels for any car, wire and tubing) do not qualify, however good they are; leave them out entirely. A part made for another boxing of the same tooling qualifies only if a listing says so.

Where to look: Spotmodel (spotmodel.com), whose search lists a kit's upgrade parts beside it — its search page for this kit is given below, fetch it first. Then makers' own pages (Hobby Design, Studio27, Top Studio, Scale Motorsport, Eduard, Aires, Shunko, Museum Collection, Decalcas, Indycals and the like) and shops (HLJ, HobbySearch, Scale Hobbyist). Scalemates lists a kit's aftermarket but blocks automated fetching; its search snippets are fine to use.

For each part, report: maker, product name, product code if listed, kind (detail-up, photo-etch, decals, wheels, resin, masks, transkit or other), one sentence on what it adds or replaces, and the words on the page that tie it to this kit.

Next to each part, write every URL you saw it at, in full, as plain text starting with https:// — not a footnote, not a bare domain, not a markdown link. A later step reads those URLs out of your prose and drops any part it cannot find one for. A part sold in three shops is worth listing with all three: the number of sites that carry it is how the list is ordered.

If nothing made for this kit turns up, say so plainly — many kits have no aftermarket, and an empty answer is a real one. Never present a part you inferred or remember as though a page listed it for this kit. Search only as much as it takes; the budget is small on purpose.`;

const EXTRACT_PROMPT = `You turn a write-up about aftermarket parts for a scale-model kit into structured data. You are reformatting, not researching: add nothing the write-up doesn't say.

Rules:
- One entry per product. sourceUrls is every URL the write-up gave for that product — never a URL it gave for a different one, never an invented one. A product with no URL is left out.
- madeFor is the write-up's evidence that the product was made for this kit, e.g. "listed for NuNu PN24030". If the write-up presents a product as a generic fit, or gives no such evidence, set madeFor to null.
- kind is one of: detail-up, photo-etch, decals, wheels, resin, masks, transkit, other.
- An empty upgrades array is correct when the write-up found nothing made for this kit.`;

type StageResult<T> = Result<T & { usage: RunUsage }, { usage: RunUsage }>;

/**
 * Runs, or resumes, one upgrades job to the end. Never throws: every failure
 * is recorded on the job with a reason the kit page shows (§7 rule 1).
 *
 * `resume` skips stage B when the job already holds its write-up — the retry
 * after a failed stage C.
 */
export async function runUpgradesResearch(jobId: string, kitId: number, resume = false): Promise<void> {
  try {
    // Uncached on purpose: this runs in `after()`, outside any render, and
    // wants the row as it is now — a rename since the add should be searched.
    const kit = await findKitById(kitId);
    if (!kit) {
      await recordStage(jobId, "investigate", { ok: false, error: "That kit is no longer here." });
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      await recordStage(jobId, "investigate", {
        ok: false,
        error: "The upgrades search isn't set up — ANTHROPIC_API_KEY is missing.",
      });
      return;
    }

    const client = new Anthropic();

    let partial = resume ? await findUpgradesJobPartial(jobId, kitId) : undefined;
    if (!partial) {
      const startedAt = Date.now();
      const investigated = await investigate(client, kit);
      const outcome = { ok: investigated.ok, error: investigated.ok ? undefined : investigated.error, durationMs: Date.now() - startedAt };
      const keep = investigated.ok ? investigated.partial : undefined;
      await recordStage(jobId, "investigate", outcome, { next: "extract", usage: investigated.usage, partial: keep });
      if (!investigated.ok) return;
      partial = investigated.partial;
    }

    const startedAt = Date.now();
    const extracted = await extract(client, kit, partial);
    if (!extracted.ok) {
      await recordStage(jobId, "extract", { ok: false, error: extracted.error, durationMs: Date.now() - startedAt }, { usage: extracted.usage });
      return;
    }

    const total = await recordStage(
      jobId,
      "extract",
      { ok: true, durationMs: Date.now() - startedAt },
      { next: "done", usage: extracted.usage },
    );

    await replaceKitUpgrades({
      kitId,
      jobId,
      upgrades: extracted.upgrades,
      sources: partial.sources,
      modelUsed: MODEL,
      usage: total,
    });

    // §7 rule 2: say what changed. One line per run in the function log is
    // also the cost measurement's raw data — the owner asked for every add
    // to search, on condition that what it costs is visible.
    console.info(
      `[kit-upgrades] kit ${kitId} job ${jobId}: ${extracted.upgrades.length} upgrades, ` +
        `${total.webSearches} searches, ${total.inputTokens}+${total.cacheReadTokens}r+${total.cacheWriteTokens}w in / ${total.outputTokens} out, ` +
        `~${formatCost(runCostUsd(total))}`,
    );

    // `revalidateTag` with immediate expiry rather than `updateTag`: this runs
    // in `after()`, past the action's response, and the panel's next poll
    // has to see the new list, not a stale-while-revalidate copy of none.
    revalidateTag(kitTag(kitId), { expire: 0 });
  } catch (error) {
    // Only a database failure gets here — both stages catch their own API
    // errors. Best effort: if the job can't be written either, the stall rule
    // ends the spinner.
    console.error(`[kit-upgrades] job ${jobId} failed outside a stage:`, error);
    await recordStage(jobId, "extract", { ok: false, error: "The upgrades search couldn't save its result — try again." }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Stage B
// ---------------------------------------------------------------------------

async function investigate(
  client: Anthropic,
  kit: KitRow,
): Promise<StageResult<{ partial: UpgradesJobPartial }>> {
  const subject = [kit.brand, kit.kitNumber, kit.name, kit.scale].filter(Boolean).join(" ");
  const spotmodel = spotmodelSearchUrl(kit);

  const requestParams = {
    // Sonnet 5 at `medium`, as the research this replaced settled on (§5.3).
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "medium" as const },
    // Caches the growing conversation across `pause_turn` resumes.
    cache_control: { type: "ephemeral" as const },
    system: INVESTIGATE_PROMPT,
    tools: [
      {
        type: "web_search_20260209" as const,
        name: "web_search" as const,
        max_uses: MAX_SEARCHES,
        // Direct, not the dynamic-filtering default: under it the
        // `web_search_result_location` citations this depends on largely stop
        // appearing (§5.2, HISTORY.md).
        allowed_callers: ["direct" as const],
      },
      {
        type: "web_fetch_20260209" as const,
        name: "web_fetch" as const,
        max_uses: MAX_FETCHES,
        // A fetch's source is the URL it was asked for, so it keeps the
        // cheaper filtered default; `collectUrls` reads it at any depth.
        max_content_tokens: MAX_FETCH_TOKENS,
        citations: { enabled: true },
      },
    ],
  };

  // The Spotmodel URL goes in the user turn on purpose: web fetch only opens
  // URLs already in the conversation, and this one is the owner's own shop's
  // search for exactly this kit.
  let messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: spotmodel
        ? `Find upgrades made for this kit: ${subject}\n\nSpotmodel's search for it: ${spotmodel}`
        : `Find upgrades made for this kit: ${subject}`,
    },
  ];

  let usage = NO_USAGE;
  try {
    // Streamed because this runs for minutes — a non-streaming request that
    // long risks the SDK's own HTTP timeout (§5.2).
    let response = await client.messages.stream({ ...requestParams, messages }).finalMessage();
    usage = addUsage(usage, response.usage);

    let resumes = 0;
    while (response.stop_reason === "pause_turn" && resumes < MAX_RESUMES) {
      messages = [...messages, { role: "assistant", content: response.content }];
      response = await client.messages.stream({ ...requestParams, messages }).finalMessage();
      usage = addUsage(usage, response.usage);
      resumes++;
    }

    const { prose, sources } = collectProseAndSources(response);

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The upgrades search couldn't be completed — try again.", usage };
    }
    if (response.stop_reason === "pause_turn") {
      return { ok: false, error: "The upgrades search ran long and didn't finish — try again.", usage };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, error: "The upgrades search wrote more than it could fit — try again.", usage };
    }
    if (!prose) {
      return {
        ok: false,
        error: webToolErrored(response.content)
          ? "The upgrades search hit a problem searching the web — try again."
          : "The upgrades search came back empty — try again.",
        usage,
      };
    }

    return { ok: true, partial: { prose, sources }, usage };
  } catch (error) {
    logAnthropicError("kit-upgrades/investigate", error);
    return { ok: false, error: describeAnthropicError(error, "The upgrades search"), usage };
  }
}

/**
 * The write-up, and every URL the model cited or touched. Citations are
 * structured here and plain text once handed on, so they're collected now;
 * the inline URLs the prompt asks for are the fallback, and in practice a
 * productive one.
 */
function collectProseAndSources(response: Anthropic.Message): UpgradesJobPartial {
  const parts: string[] = [];
  const sources = new Set<string>();

  for (const block of response.content) {
    if (block.type === "text") {
      parts.push(block.text);
      for (const citation of block.citations ?? []) {
        if ("url" in citation && typeof citation.url === "string") sources.add(citation.url);
      }
      continue;
    }
    collectUrls(block, sources);
  }

  const prose = parts.join("\n\n").trim();
  for (const url of prose.match(/https?:\/\/[^\s<>"')\]]+/g) ?? []) {
    sources.add(url.replace(/[.,;:]+$/, ""));
  }

  return { prose, sources: [...sources] };
}

/** Every `url` in a tool block, at any depth — the result shapes differ
 * between tools and nest under dynamic filtering, and assuming one of them
 * already cost two paid runs (HISTORY.md). */
function collectUrls(value: unknown, sources: Set<string>, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const entry of value) collectUrls(entry, sources, depth + 1);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === "url" && typeof entry === "string" && /^https?:\/\//.test(entry)) sources.add(entry);
    else if (typeof entry === "object") collectUrls(entry, sources, depth + 1);
  }
}

// ---------------------------------------------------------------------------
// Stage C
// ---------------------------------------------------------------------------

async function extract(
  client: Anthropic,
  kit: KitRow,
  partial: UpgradesJobPartial,
): Promise<StageResult<{ upgrades: ReturnType<typeof normalizeUpgrades> }>> {
  let usage = NO_USAGE;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: zodOutputFormat(KitUpgradesSchema) },
      system: EXTRACT_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            `Here is the write-up for ${[kit.brand, kit.kitNumber, kit.name].filter(Boolean).join(" ")}.`,
            partial.sources.length > 0
              ? `These URLs were consulted — use them to resolve any link the write-up abbreviates:\n${partial.sources.map((s) => `- ${s}`).join("\n")}`
              : "No separate source list was captured, so take every URL from the write-up itself.",
            "---",
            partial.prose,
          ].join("\n\n"),
        },
      ],
    });
    usage = addUsage(usage, response.usage);

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "Filing the upgrades couldn't be completed — try again.", usage };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, error: "The upgrades list was longer than filing could fit — try again.", usage };
    }
    if (!response.parsed_output) {
      return { ok: false, error: "Filing the upgrades returned something unexpected — try again.", usage };
    }

    // Where "made for this kit" and §5.4 are enforced — see `normalizeUpgrades`.
    return { ok: true, upgrades: normalizeUpgrades(response.parsed_output), usage };
  } catch (error) {
    logAnthropicError("kit-upgrades/extract", error);
    return { ok: false, error: describeAnthropicError(error, "Filing the upgrades"), usage };
  }
}
