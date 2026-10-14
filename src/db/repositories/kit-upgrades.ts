import { and, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { db } from "@/db/client";
import { kitResearch, researchJob } from "@/db/schema";
import { NO_USAGE, readUsage, sumUsage, type KitUpgrade, type RunUsage, type UpgradesJob } from "@/domain/kit-upgrades";

import { kitTag } from "./kits";

/**
 * `research_job` and `kit_research` — the upgrades search's work in progress
 * and its finished answer. docs/PLAN.md §5.1.
 *
 * Two tables because the pipeline is staged: the job carries what stage B
 * wrote, so a failed stage C retries for cents instead of re-buying the web
 * search; and it carries what is happening *now*, which is how the kit page
 * shows a search that started in the background when the kit was added.
 *
 * Same two-layer shape as `./kits.ts` for the finished answer: `connection()`
 * then `use cache` under the kit's own tag. Job reads are uncached throughout
 * — the page polls one while a search runs.
 */

export interface KitUpgradesRow {
  upgrades: KitUpgrade[];
  usage: RunUsage;
  researchedAt: Date | null;
}

/** Tagged on the kit: nothing but that kit's page reads it, so `kitTag(id)`,
 * which every other panel there already uses, is the right granularity. */
export async function getKitUpgrades(kitId: number): Promise<KitUpgradesRow | undefined> {
  await connection();
  return queryKitUpgrades(kitId);
}

async function queryKitUpgrades(kitId: number): Promise<KitUpgradesRow | undefined> {
  "use cache";
  cacheLife("wishlist");
  cacheTag(kitTag(kitId));

  const rows = await db
    .select({ upgrades: kitResearch.upgrades, usage: kitResearch.usage, researchedAt: kitResearch.researchedAt })
    .from(kitResearch)
    .where(eq(kitResearch.kitId, kitId))
    .orderBy(desc(kitResearch.researchedAt))
    .limit(1);

  const row = rows[0];
  return row ? { upgrades: row.upgrades ?? [], usage: readUsage(row.usage), researchedAt: row.researchedAt } : undefined;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function createUpgradesJob(kitId: number, query: string): Promise<string> {
  const now = new Date();
  const rows = await db
    .insert(researchJob)
    .values({ kitId, query, stage: "investigate", usage: { ...NO_USAGE }, startedAt: now, updatedAt: now })
    .returning({ id: researchJob.id });
  return rows[0].id;
}

/** The kit's newest job, for the panel's progress and failure states and
 * for `searchKitUpgrades`' one-at-a-time check. Uncached: it is read while
 * the job is moving. No `connection()` of its own — an action calls it too —
 * so the panel reads `getKitUpgrades` first, which pins render time. */
export async function getLatestUpgradesJob(kitId: number): Promise<UpgradesJob | undefined> {
  const rows = await db
    .select({
      id: researchJob.id,
      stage: researchJob.stage,
      stageStatus: researchJob.stageStatus,
      partial: researchJob.partial,
      error: researchJob.error,
      startedAt: researchJob.startedAt,
      updatedAt: researchJob.updatedAt,
    })
    .from(researchJob)
    .where(eq(researchJob.kitId, kitId))
    .orderBy(desc(researchJob.startedAt))
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    stage: row.stage,
    error: row.error,
    startedAt: row.startedAt,
    updatedAt: row.updatedAt,
    hasWriteUp: Boolean(row.stageStatus?.investigate?.ok) && typeof row.partial?.prose === "string",
  };
}

export interface UpgradesJobPartial {
  prose: string;
  sources: string[];
}

/** Scoped to `kitId` as well as the id — an id alone is not an authorisation
 * to act on a row, the rule every mutation in `kits.ts` follows. */
export async function findUpgradesJobPartial(id: string, kitId: number): Promise<UpgradesJobPartial | undefined> {
  const rows = await db
    .select({ partial: researchJob.partial })
    .from(researchJob)
    .where(and(eq(researchJob.id, id), eq(researchJob.kitId, kitId)))
    .limit(1);
  const partial = rows[0]?.partial;
  if (!partial || typeof partial.prose !== "string") return undefined;
  return {
    prose: partial.prose,
    sources: Array.isArray(partial.sources) ? partial.sources.filter((s): s is string => typeof s === "string") : [],
  };
}

/** Moves a job to the stage it is about to run, clearing an old failure —
 * the retry path, which re-runs stage C on a job whose stage B is paid for. */
export async function setUpgradesJobStage(id: string, stage: "investigate" | "extract"): Promise<void> {
  await db.update(researchJob).set({ stage, error: null, updatedAt: new Date() }).where(eq(researchJob.id, id));
}

export interface StageOutcome {
  ok: boolean;
  error?: string;
  durationMs?: number;
}

/**
 * Records what a stage did, what it cost, and what runs next.
 *
 * `stageStatus` and `usage` accumulate rather than replace: a job whose stage
 * C failed twice before succeeding still says stage B went fine, and still
 * counts what the two failures cost. Read-modify-write is safe here — one
 * person, and a kit runs one search at a time (`startUpgradesSearch`).
 */
export async function recordStage(
  id: string,
  stage: "investigate" | "extract",
  outcome: StageOutcome,
  options: { next?: "extract" | "done"; usage?: RunUsage; partial?: UpgradesJobPartial } = {},
): Promise<RunUsage> {
  const existing = await db
    .select({ stageStatus: researchJob.stageStatus, usage: researchJob.usage })
    .from(researchJob)
    .where(eq(researchJob.id, id))
    .limit(1);

  const before = readUsage(existing[0]?.usage);
  const usage = options.usage ? sumUsage(before, options.usage) : before;

  await db
    .update(researchJob)
    .set({
      stage: outcome.ok ? (options.next ?? stage) : "failed",
      stageStatus: { ...(existing[0]?.stageStatus ?? {}), [stage]: outcome },
      usage: { ...usage },
      ...(options.partial ? { partial: { ...options.partial } } : {}),
      error: outcome.error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(researchJob.id, id));

  return usage;
}

// ---------------------------------------------------------------------------
// The finished result
// ---------------------------------------------------------------------------

export interface SaveUpgradesInput {
  kitId: number;
  jobId: string;
  upgrades: KitUpgrade[];
  sources: string[];
  modelUsed: string;
  usage: RunUsage;
}

/**
 * Replaces this kit's upgrades with a new run's answer.
 *
 * Insert then delete, for the same reason as `replaceManualPaintRequirements`:
 * Neon's HTTP driver has no transactions (see `scripts/migrate.mts`), so the
 * order decides what a failure part-way leaves. A failed insert keeps the
 * previous answer — which cost money — and a failed delete leaves a
 * superseded row that `getKitUpgrades` ignores, since it reads the newest.
 */
export async function replaceKitUpgrades(input: SaveUpgradesInput): Promise<void> {
  const superseded = await db
    .select({ id: kitResearch.id })
    .from(kitResearch)
    .where(eq(kitResearch.kitId, input.kitId));

  await db.insert(kitResearch).values({
    kitId: input.kitId,
    jobId: input.jobId,
    upgrades: input.upgrades,
    sources: input.sources,
    modelUsed: input.modelUsed,
    usage: { ...input.usage },
    researchedAt: new Date(),
  });

  for (const row of superseded) {
    await db.delete(kitResearch).where(eq(kitResearch.id, row.id));
  }
}
