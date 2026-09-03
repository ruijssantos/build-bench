import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import {
  findResearchJob,
  recordStage,
  replaceKitResearch,
} from "@/db/repositories/kit-research";
import { getKitById, kitTag } from "@/db/repositories/kits";
import { isStashStatus } from "@/domain/kit";
import { KitResearchSchema, normalizeResearch } from "@/domain/kit-research";
import { describeAnthropicError, logAnthropicError } from "@/lib/anthropic-errors";

/**
 * Kit research, stage C — docs/PLAN.md §5.1, §5.2, §6 Phase 7.
 *
 * Stage B's cited prose in, typed rows out. No web tools: everything this call
 * needs is already in the text it is given, and letting it search again would
 * open the door to claims with no citation behind them — the exact thing §5.4
 * forbids.
 *
 * Cheap on purpose. This is the stage that fails — a schema that doesn't
 * validate, a model that answers in the wrong shape — and it is separated from
 * stage B so that failing costs cents rather than the whole ~€0.20–0.45 run
 * (§5.3). The client retries this one alone against the same `research_job`.
 */

export const maxDuration = 300;

const SYSTEM_PROMPT = `You turn a research write-up about a scale-model kit into structured data. The write-up was produced by a researcher who was told to cite a URL next to every claim.

Rules:
- Every fit issue and every tip must carry the sourceUrl the write-up gave for that specific claim. If a claim in the write-up has no URL attached to it, leave it out entirely rather than borrowing a URL from a different claim or inventing one.
- Do not add anything the write-up doesn't say. You are reformatting, not researching. If the write-up is thin, the output is thin.
- confidence is 0-1: use the write-up's own hedging as your guide. "Several builders report" is high; "one person mentioned" is low.
- severity is minor, moderate or major. category is prep, paint, decals, assembly, tools or reference.
- difficulty is beginner, intermediate or advanced, or null if the write-up says sources disagreed.
- Empty arrays are correct and expected when the write-up found no issues or no tips.`;

interface ExtractResponse {
  ok: boolean;
  issueCount?: number;
  tipCount?: number;
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

  const { kitId, jobId } = (body as { kitId?: unknown; jobId?: unknown } | null) ?? {};
  if (!Number.isInteger(kitId) || typeof jobId !== "string" || !jobId) {
    return jsonError("Missing research job — try again.", 400);
  }

  const kit = await getKitById(kitId as number);
  if (!kit || !isStashStatus(kit.status)) {
    return jsonError("That kit is no longer in the stash.");
  }

  // Scoped to the kit, so one kit's job id can't write another kit's research.
  const job = await findResearchJob(jobId, kitId as number);
  if (!job) {
    return jsonError("That research run is no longer here — start it again.");
  }

  const prose = typeof job.partial?.prose === "string" ? job.partial.prose : "";
  const sources = Array.isArray(job.partial?.sources) ? (job.partial.sources as string[]) : [];
  if (!prose) {
    return jsonError("That research run has nothing to read back — start it again.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("Kit research isn't set up yet — ANTHROPIC_API_KEY is missing.");
  }

  const client = new Anthropic();
  const startedAt = Date.now();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // Lower than stage B's `high`: this is reformatting text that is already
      // in front of it, not synthesis. The judgement was spent upstream.
      output_config: { effort: "medium", format: zodOutputFormat(KitResearchSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the research write-up for ${[kit.brand, kit.kitNumber, kit.name].filter(Boolean).join(" ")}.\n\nThese are the URLs it cited:\n${sources.map((s) => `- ${s}`).join("\n")}\n\n---\n\n${prose}`,
        },
      ],
    });

    const failed = async (error: string) => {
      await recordStage(jobId, "extract", { ok: false, error, durationMs: Date.now() - startedAt });
      return jsonError(error);
    };

    if (response.stop_reason === "refusal") {
      return failed("That research couldn't be filed — try again.");
    }
    if (response.stop_reason === "max_tokens") {
      return failed("That research write-up was longer than filing could fit — try again.");
    }
    if (!response.parsed_output) {
      return failed("Filing the research returned something unexpected — try again.");
    }

    // Coercion, not rejection — and the place §5.4 is enforced: every claim
    // whose source URL doesn't parse is dropped here rather than rendered
    // without one. See `normalizeResearch`.
    const research = normalizeResearch(response.parsed_output);

    if (research.fitIssues.length === 0 && research.tips.length === 0 && !research.difficulty) {
      return failed(
        "Research found nothing solid enough to source for this kit. Obscure or very new kits often have no build threads yet.",
      );
    }

    const stageBInput = typeof job.partial?.inputTokens === "number" ? job.partial.inputTokens : 0;
    const stageBOutput = typeof job.partial?.outputTokens === "number" ? job.partial.outputTokens : 0;

    await replaceKitResearch({
      ...research,
      kitId: kitId as number,
      jobId,
      sources,
      modelUsed: "claude-opus-5",
      // Both stages' tokens, because what the owner spent on this research is
      // one number, not two — §5.3 wants the per-kit cost legible.
      inputTokens: stageBInput + response.usage.input_tokens,
      outputTokens: stageBOutput + response.usage.output_tokens,
    });

    await recordStage(jobId, "extract", {
      ok: true,
      durationMs: Date.now() - startedAt,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    });

    // `revalidateTag`, not `updateTag`: this is a Route Handler, where
    // `updateTag` throws by design — the lesson `kits/extract/route.ts` learned
    // the expensive way, where the throw landed in that function's own catch
    // and made every successful run report failure.
    revalidateTag(kitTag(kitId as number), "max");

    return NextResponse.json<ExtractResponse>({
      ok: true,
      issueCount: research.fitIssues.length,
      tipCount: research.tips.length,
    });
  } catch (error) {
    logAnthropicError("kits/research/extract", error);
    const message = describeAnthropicError(error, "Filing the research");
    await recordStage(jobId, "extract", {
      ok: false,
      error: message,
      durationMs: Date.now() - startedAt,
    }).catch(() => {});
    return jsonError(message);
  }
}
