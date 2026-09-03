import { and, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { kitResearch, researchJob } from "@/db/schema";
import type { NormalizedResearch } from "@/domain/kit-research";

import { kitTag } from "./kits";

/**
 * `research_job` and `kit_research` — docs/PLAN.md §5.1, §6 Phase 7.
 *
 * Two tables for one feature because the pipeline is staged: `research_job`
 * is the work in progress (which stage, what stage B produced, what failed),
 * `kit_research` is the finished, cached answer. Only the second is read by
 * the page; the first exists so stage C can be retried for cents when it
 * fails, rather than re-paying for stage B's three minutes of web search.
 *
 * Same two-layer shape as `./kits.ts`: `connection()` pins the read to request
 * time so `next build` never opens a database, then `use cache` makes a repeat
 * visit free. Job rows are uncached throughout — every read of one is
 * immediately before a write, or is polling a run in progress.
 */

export interface KitResearchRow {
  id: number;
  kitId: number | null;
  jobId: string;
  difficulty: string | null;
  difficultyNote: string | null;
  fitIssues: Array<{ issue: string; severity: string; sourceUrl: string; confidence: number }> | null;
  tips: Array<{ tip: string; category: string; sourceUrl: string; confidence: number }> | null;
  buildVideoUrl: string | null;
  manualUrl: string | null;
  sources: string[] | null;
  modelUsed: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  verifiedByMe: boolean | null;
  researchedAt: Date | null;
}

/** Tagged on the kit rather than on a tag of its own: research is part of one
 * kit's detail page and nothing else reads it, so `kitTag(id)` — which every
 * other panel on that page already uses — is exactly the right granularity. */
export async function getKitResearch(kitId: number): Promise<KitResearchRow | undefined> {
  await connection();
  return queryKitResearch(kitId);
}

async function queryKitResearch(kitId: number): Promise<KitResearchRow | undefined> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(kitTag(kitId));

  const rows = await db
    .select({
      id: kitResearch.id,
      kitId: kitResearch.kitId,
      jobId: kitResearch.jobId,
      difficulty: kitResearch.difficulty,
      difficultyNote: kitResearch.difficultyNote,
      fitIssues: kitResearch.fitIssues,
      tips: kitResearch.tips,
      buildVideoUrl: kitResearch.buildVideoUrl,
      manualUrl: kitResearch.manualUrl,
      sources: kitResearch.sources,
      modelUsed: kitResearch.modelUsed,
      inputTokens: kitResearch.inputTokens,
      outputTokens: kitResearch.outputTokens,
      verifiedByMe: kitResearch.verifiedByMe,
      researchedAt: kitResearch.researchedAt,
    })
    .from(kitResearch)
    .where(eq(kitResearch.kitId, kitId))
    .orderBy(desc(kitResearch.researchedAt))
    .limit(1);

  return rows[0];
}

// ---------------------------------------------------------------------------
// Jobs — the staged pipeline's own state
// ---------------------------------------------------------------------------

export interface ResearchJobRow {
  id: string;
  kitId: number | null;
  stage: string | null;
  partial: Record<string, unknown> | null;
  error: string | null;
}

export async function createResearchJob(kitId: number, query: string): Promise<string> {
  const rows = await db
    .insert(researchJob)
    .values({ kitId, query, stage: "investigate", startedAt: new Date(), updatedAt: new Date() })
    .returning({ id: researchJob.id });
  return rows[0].id;
}

/** Scoped to `kitId` as well as the job id, the same rule every mutation in
 * `kits.ts` follows: an id alone is not an authorisation to act on a row, and
 * stage C is handed both by a client. */
export async function findResearchJob(id: string, kitId: number): Promise<ResearchJobRow | undefined> {
  const rows = await db
    .select({
      id: researchJob.id,
      kitId: researchJob.kitId,
      stage: researchJob.stage,
      partial: researchJob.partial,
      error: researchJob.error,
    })
    .from(researchJob)
    .where(and(eq(researchJob.id, id), eq(researchJob.kitId, kitId)))
    .limit(1);
  return rows[0];
}

export interface StageOutcome {
  ok: boolean;
  error?: string;
  durationMs?: number;
  tokens?: number;
}

/**
 * Records what a stage did and what the next one should pick up.
 *
 * `stageStatus` accumulates rather than replaces — a job that failed stage C
 * twice and then succeeded should still say stage B went fine, since that is
 * the run the money was spent on. Read-modify-write is safe here in a way it
 * would not be in a multi-user app: one person, one button, and the button is
 * disabled while a stage is in flight.
 */
export async function recordStage(
  id: string,
  stage: string,
  outcome: StageOutcome,
  partial?: Record<string, unknown>,
): Promise<void> {
  const existing = await db
    .select({ stageStatus: researchJob.stageStatus })
    .from(researchJob)
    .where(eq(researchJob.id, id))
    .limit(1);

  await db
    .update(researchJob)
    .set({
      stage: outcome.ok ? stage : "failed",
      stageStatus: { ...(existing[0]?.stageStatus ?? {}), [stage]: outcome },
      ...(partial ? { partial } : {}),
      error: outcome.error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(researchJob.id, id));
}

// ---------------------------------------------------------------------------
// The finished result
// ---------------------------------------------------------------------------

export interface SaveResearchInput extends NormalizedResearch {
  kitId: number;
  jobId: string;
  sources: string[];
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Replaces this kit's research with a new run's answer.
 *
 * Insert then delete, the same order and for the same reason as
 * `replaceManualPaintRequirements`: Neon's HTTP driver has no transactions
 * (see `scripts/migrate.mts`), so the ordering decides what a failure part-way
 * leaves behind. This way a failed insert leaves the previous research intact
 * — and that research cost real money — while a failed delete leaves a
 * superseded row that `getKitResearch` already ignores, since it reads the
 * newest by `researched_at`.
 *
 * `verified_by_me` deliberately does not carry over. A Verify mark is the
 * owner's judgement on *those* claims (§5.4); re-running research produces new
 * ones, and inheriting the tick would mark as checked a set of sentences
 * nobody has read.
 */
export async function replaceKitResearch(input: SaveResearchInput): Promise<void> {
  const superseded = await db
    .select({ id: kitResearch.id })
    .from(kitResearch)
    .where(eq(kitResearch.kitId, input.kitId));

  await db.insert(kitResearch).values({
    kitId: input.kitId,
    jobId: input.jobId,
    difficulty: input.difficulty,
    difficultyNote: input.difficultyNote,
    fitIssues: input.fitIssues,
    tips: input.tips,
    buildVideoUrl: input.buildVideoUrl,
    manualUrl: input.manualUrl,
    sources: input.sources,
    modelUsed: input.modelUsed,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    verifiedByMe: false,
    researchedAt: new Date(),
  });

  for (const row of superseded) {
    await db.delete(kitResearch).where(eq(kitResearch.id, row.id));
  }
}

/** §5.4's Verify action. Scoped by `kitId` so one kit's research id can't be
 * used to mark another kit's. */
export async function setResearchVerified(id: number, kitId: number, verified: boolean): Promise<boolean> {
  const rows = await db
    .update(kitResearch)
    .set({ verifiedByMe: verified })
    .where(and(eq(kitResearch.id, id), eq(kitResearch.kitId, kitId)))
    .returning({ id: kitResearch.id });
  return rows.length > 0;
}
