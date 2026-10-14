import { z } from "zod";

/**
 * Kit upgrades — the aftermarket parts made for one specific kit, and what
 * finding them cost. docs/PLAN.md §5. Pure: no data, no I/O.
 *
 * This replaced the research panel's difficulty, fit issues and tips (§7):
 * at the bench the owner never read those, and what they did go looking for,
 * every build, was which detail-up set, photo-etch fret or decal sheet exists
 * for the kit in front of them. The rule from §5.4 carries straight over —
 * **a model read this off the web, so none of it appears without the page it
 * came from** — plus one more of its own: only parts made *for this kit*. A
 * generic 1/24 seatbelt set fits a thousand kits and is not an answer to
 * "what's out there for this one".
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const UPGRADE_KINDS = ["detail-up", "photo-etch", "decals", "wheels", "resin", "masks", "transkit", "other"] as const;
type UpgradeKind = (typeof UPGRADE_KINDS)[number];

function isUpgradeKind(value: unknown): value is UpgradeKind {
  return typeof value === "string" && (UPGRADE_KINDS as readonly string[]).includes(value);
}

const KIND_LABEL: Record<UpgradeKind, string> = {
  "detail-up": "Detail-up set",
  "photo-etch": "Photo-etch",
  decals: "Decals",
  wheels: "Wheels",
  resin: "Resin parts",
  masks: "Masks",
  transkit: "Transkit",
  other: "Upgrade",
};

export function upgradeKindLabel(value: string): string {
  return isUpgradeKind(value) ? KIND_LABEL[value] : KIND_LABEL.other;
}

/** What a model reaches for when it isn't quoting the list back — mapping
 * them costs nothing, and "Other" for a decal sheet would be a lost label. */
const KIND_ALIASES: Record<string, UpgradeKind> = {
  "detail up": "detail-up",
  "detail-up set": "detail-up",
  "detail set": "detail-up",
  "upgrade set": "detail-up",
  "grade-up": "detail-up",
  pe: "photo-etch",
  "photo etch": "photo-etch",
  photoetch: "photo-etch",
  etch: "photo-etch",
  decal: "decals",
  "decal sheet": "decals",
  wheel: "wheels",
  rims: "wheels",
  tyres: "wheels",
  tires: "wheels",
  mask: "masks",
  "conversion": "transkit",
  "conversion kit": "transkit",
};

function coerceKind(raw: unknown): UpgradeKind {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (isUpgradeKind(value)) return value;
  return KIND_ALIASES[value] ?? "other";
}

// ---------------------------------------------------------------------------
// Stage C's wire schema
// ---------------------------------------------------------------------------

/**
 * Loose on the wire and coerced after (§7): `kind` is a plain string, and an
 * off-list word costs a label rather than the run. `madeFor` is the one field
 * not rendered — it is the evidence the normaliser gates on, so "made for
 * this kit" is checked in code rather than trusted from the prompt.
 */
export const KitUpgradesSchema = z.object({
  upgrades: z
    .array(
      z.object({
        maker: z.string().nullable().describe("Who makes it, e.g. 'Hobby Design', 'Studio27', 'Eduard'"),
        name: z.string().describe("The product's name as the maker or shop lists it"),
        code: z.string().nullable().describe("The maker's product code, e.g. 'HD02-0423', or null"),
        kind: z.string().describe("detail-up, photo-etch, decals, wheels, resin, masks, transkit or other"),
        adds: z.string().nullable().describe("One sentence on what it adds or replaces"),
        madeFor: z
          .string()
          .nullable()
          .describe("Where the write-up shows it was made for this kit, e.g. 'listed for NuNu PN24030'; null if it is a generic part"),
        sourceUrls: z.array(z.string()).describe("Every URL the write-up gave for this product"),
      }),
    )
    .describe("Aftermarket parts made for this kit. Empty array if none were found."),
});

export type RawKitUpgrades = z.infer<typeof KitUpgradesSchema>;

// ---------------------------------------------------------------------------
// Normalisation — where §5.4 and "made for this kit" are enforced
// ---------------------------------------------------------------------------

export interface KitUpgrade {
  maker: string | null;
  name: string;
  code: string | null;
  kind: string;
  adds: string | null;
  /** Distinct pages, best first; never empty — a part with no page doesn't ship. */
  sourceUrls: string[];
}

/** A source has to be a real, public http(s) URL — one the reader can open
 * and judge — or it isn't a source (§5.4). Nothing here is fetched. */
function usableSourceUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href.slice(0, 2000);
  } catch {
    return null;
  }
}

function trimText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** "forums.example.com/thread/12" → "forums.example.com", for the link label.
 * The host is what tells you whether to trust it. */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

/** One link per site: three pages of the same shop are one shop saying it. */
function distinctBySite(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const host = sourceHost(url);
    if (seen.has(host)) return false;
    seen.add(host);
    return true;
  });
}

/** A screenful. The prompt asks for what exists, not a catalogue; past this
 * it's the tail of the least-mentioned. */
const MAX_UPGRADES = 12;

/**
 * Stage C's answer, as stored. Drops a part that
 *
 *   - has no name,
 *   - has no `madeFor` — the write-up couldn't tie it to this kit, so it's a
 *     generic fit the owner asked not to see, or
 *   - has no usable source (§5.4);
 *
 * merges duplicates (same maker and code, or same maker and name) and ranks
 * by how many different sites mention each — popularity, which is what the
 * panel's caveat says the order means, and nothing stronger.
 */
export function normalizeUpgrades(raw: RawKitUpgrades): KitUpgrade[] {
  const byKey = new Map<string, KitUpgrade>();

  for (const row of raw.upgrades) {
    const name = trimText(row.name, 200);
    if (!name || !trimText(row.madeFor, 300)) continue;

    const sourceUrls = row.sourceUrls.map(usableSourceUrl).filter((url): url is string => url !== null);
    if (sourceUrls.length === 0) continue;

    const maker = trimText(row.maker, 80);
    const code = trimText(row.code, 40);
    const key = `${maker ?? ""}|${(code ?? name).toLowerCase()}`;

    const existing = byKey.get(key);
    if (existing) {
      existing.sourceUrls = distinctBySite([...existing.sourceUrls, ...sourceUrls]);
      existing.adds ??= trimText(row.adds, 300);
      continue;
    }

    byKey.set(key, {
      maker,
      name,
      code,
      kind: coerceKind(row.kind),
      adds: trimText(row.adds, 300),
      sourceUrls: distinctBySite(sourceUrls),
    });
  }

  // `sort` is stable, so equally-mentioned parts keep the write-up's order.
  return [...byKey.values()].sort((a, b) => b.sourceUrls.length - a.sourceUrls.length).slice(0, MAX_UPGRADES);
}

// ---------------------------------------------------------------------------
// Cost — §7 rule 7: measure which end of the pipe the money is in
// ---------------------------------------------------------------------------

/** Everything one run was billed for, summed over every API call it made —
 * both stages, every `pause_turn` resume, and failed attempts. */
export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  webSearches: number;
  webFetches: number;
}

export const NO_USAGE: RunUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  webSearches: 0,
  webFetches: 0,
};

/** The subset of the API's `usage` object this reads, so the domain stays
 * free of the SDK. */
interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  server_tool_use: { web_search_requests: number; web_fetch_requests?: number } | null;
}

export function addUsage(total: RunUsage, usage: ApiUsage): RunUsage {
  return {
    inputTokens: total.inputTokens + usage.input_tokens,
    outputTokens: total.outputTokens + usage.output_tokens,
    cacheWriteTokens: total.cacheWriteTokens + (usage.cache_creation_input_tokens ?? 0),
    cacheReadTokens: total.cacheReadTokens + (usage.cache_read_input_tokens ?? 0),
    webSearches: total.webSearches + (usage.server_tool_use?.web_search_requests ?? 0),
    webFetches: total.webFetches + (usage.server_tool_use?.web_fetch_requests ?? 0),
  };
}

export function sumUsage(a: RunUsage, b: RunUsage): RunUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    webSearches: a.webSearches + b.webSearches,
    webFetches: a.webFetches + b.webFetches,
  };
}

/** A stored usage object read back loosely — a jsonb column is whatever was
 * written to it, and a missing field is a zero, not a crash. */
export function readUsage(value: unknown): RunUsage {
  const raw = (value ?? {}) as Partial<Record<keyof RunUsage, unknown>>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    inputTokens: n(raw.inputTokens),
    outputTokens: n(raw.outputTokens),
    cacheWriteTokens: n(raw.cacheWriteTokens),
    cacheReadTokens: n(raw.cacheReadTokens),
    webSearches: n(raw.webSearches),
    webFetches: n(raw.webFetches),
  };
}

/**
 * Claude Sonnet 5's list prices, US dollars per million tokens, and the web
 * search tool's per-call fee. Web fetch has no fee beyond the tokens it adds.
 * Cache writes are the 5-minute TTL's 1.25×, reads 0.1×. Update here if the
 * model or the prices change — the panel and the cost log both read it.
 */
const PRICE = {
  inputPerMTok: 2,
  outputPerMTok: 10,
  cacheWritePerMTok: 2.5,
  cacheReadPerMTok: 0.2,
  perWebSearch: 0.01,
};

export function runCostUsd(usage: RunUsage): number {
  return (
    (usage.inputTokens * PRICE.inputPerMTok +
      usage.outputTokens * PRICE.outputPerMTok +
      usage.cacheWriteTokens * PRICE.cacheWritePerMTok +
      usage.cacheReadTokens * PRICE.cacheReadPerMTok) /
      1_000_000 +
    usage.webSearches * PRICE.perWebSearch
  );
}

export function formatCost(usd: number): string {
  return usd < 0.01 ? "under $0.01" : `$${usd.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// A search in progress
// ---------------------------------------------------------------------------

/** The newest `research_job` for a kit, as the panel needs it. */
export interface UpgradesJob {
  id: string;
  /** `investigate` or `extract` while running; `done` or `failed` after. */
  stage: string | null;
  error: string | null;
  startedAt: Date | null;
  updatedAt: Date | null;
  /** Stage B is paid for — a retry can go straight to stage C. */
  hasWriteUp: boolean;
}

/**
 * How long a stage may go without writing before it's presumed dead. A run
 * lives inside one function invocation capped at 300s (`maxDuration` on the
 * bench layout), and every stage writes when it ends — so a job still saying
 * "investigate" well past that was killed mid-flight and will never finish.
 * Without this the panel would say "Finding upgrades…" forever.
 */
const STALLED_AFTER_MS = 6 * 60_000;

export type UpgradesJobState =
  | { state: "idle" }
  | { state: "running"; stage: "investigate" | "extract"; startedAt: Date | null }
  | { state: "failed"; error: string; canResume: boolean };

export function upgradesJobState(job: UpgradesJob | undefined, now: Date): UpgradesJobState {
  if (!job) return { state: "idle" };

  if (job.stage === "investigate" || job.stage === "extract") {
    const lastWrite = (job.updatedAt ?? job.startedAt)?.getTime() ?? 0;
    if (now.getTime() - lastWrite < STALLED_AFTER_MS) {
      return { state: "running", stage: job.stage, startedAt: job.startedAt };
    }
    return {
      state: "failed",
      error: "That search stopped before it finished — the server ran out of time.",
      canResume: job.hasWriteUp,
    };
  }

  if (job.stage === "failed") {
    return { state: "failed", error: job.error ?? "That search failed.", canResume: job.hasWriteUp };
  }

  return { state: "idle" };
}
