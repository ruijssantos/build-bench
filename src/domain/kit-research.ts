import { z } from "zod";

/**
 * Kit research vocabulary and the shape stage C returns — docs/PLAN.md §5.1,
 * §5.4. Pure: no data, no I/O.
 *
 * Everything here exists to serve one rule from §5.4, which is what separates
 * this feature from the rest of the app: **research output is synthesised from
 * forum posts by a language model, and none of it may appear as fact.** The
 * paint catalogue and the ratio rules are committed reference data; a fit
 * issue is somebody's recollection of a kit they built once. So:
 *
 *   - every claim carries the URL it came from, and `normalizeResearch` drops
 *     any claim whose source URL doesn't survive parsing — an unsourced tip is
 *     not a weaker tip, it is one this app declines to show;
 *   - difficulty is only ever rendered alongside how many sources agreed
 *     (`consensusLine`), never as a bare rating;
 *   - `verified_by_me` is the owner's own mark and outranks everything.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const RESEARCH_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type ResearchDifficulty = (typeof RESEARCH_DIFFICULTIES)[number];

export function isResearchDifficulty(value: unknown): value is ResearchDifficulty {
  return typeof value === "string" && (RESEARCH_DIFFICULTIES as readonly string[]).includes(value);
}

const DIFFICULTY_LABEL: Record<ResearchDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function difficultyLabel(value: string | null): string | null {
  return isResearchDifficulty(value) ? DIFFICULTY_LABEL[value] : null;
}

/** How much a fit issue actually costs you at the bench, which is the only
 * thing worth ranking them by. */
export const ISSUE_SEVERITIES = ["minor", "moderate", "major"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export function isIssueSeverity(value: unknown): value is IssueSeverity {
  return typeof value === "string" && (ISSUE_SEVERITIES as readonly string[]).includes(value);
}

/** Major first: the point of the list is what to know before you start. */
const SEVERITY_RANK: Record<IssueSeverity, number> = { major: 0, moderate: 1, minor: 2 };

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
};

export function severityLabel(value: string): string {
  return isIssueSeverity(value) ? SEVERITY_LABEL[value] : "Noted";
}

/** Where in a build a tip lands, so the list can be skimmed for the stage
 * you're actually at rather than read end to end. */
export const TIP_CATEGORIES = ["prep", "paint", "decals", "assembly", "tools", "reference"] as const;
export type TipCategory = (typeof TIP_CATEGORIES)[number];

export function isTipCategory(value: unknown): value is TipCategory {
  return typeof value === "string" && (TIP_CATEGORIES as readonly string[]).includes(value);
}

const TIP_CATEGORY_LABEL: Record<TipCategory, string> = {
  prep: "Prep",
  paint: "Paint",
  decals: "Decals",
  assembly: "Assembly",
  tools: "Tools",
  reference: "Reference",
};

export function tipCategoryLabel(value: string): string {
  return isTipCategory(value) ? TIP_CATEGORY_LABEL[value] : "General";
}

/**
 * §5.4's rule in one string: difficulty never appears as a bare rating.
 *
 * `null` when there is nothing honest to say — no difficulty, or a difficulty
 * with no sources behind it, in which case the caller renders neither.
 */
export function consensusLine(difficulty: string | null, sourceCount: number): string | null {
  const label = difficultyLabel(difficulty);
  if (!label || sourceCount < 1) return null;
  return `${label} · consensus from ${sourceCount} source${sourceCount === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// Stage C's wire schema
// ---------------------------------------------------------------------------

/**
 * Deliberately loose, per docs/PLAN.md §7's Phase 3 lesson: a strict enum here
 * threw away whole paid calls over one off-vocabulary word. `severity`,
 * `category` and `difficulty` are plain strings on the wire and are coerced
 * below — a model that answers "medium" instead of "moderate" should cost a
 * label, not the entire research run it took three minutes and real money to
 * produce.
 *
 * `confidence` is the one number, 0–1. It is not rendered as a percentage
 * anywhere — §5.4 wants a source link, not a false precision — but it does
 * order the lists.
 */
const ClaimFields = {
  sourceUrl: z.string().describe("The URL of the post, review or thread this came from"),
  confidence: z.number().min(0).max(1).describe("0-1, how well-supported this claim is"),
};

export const KitResearchSchema = z.object({
  difficulty: z
    .string()
    .nullable()
    .describe("beginner, intermediate or advanced — the consensus, or null if sources disagree"),
  difficultyNote: z
    .string()
    .nullable()
    .describe("One sentence on why, e.g. 'lots of small photo-etch parts'"),
  fitIssues: z
    .array(
      z.object({
        issue: z.string().describe("The specific problem, e.g. 'the bonnet sits proud unless the firewall is sanded'"),
        severity: z.string().describe("minor, moderate or major"),
        ...ClaimFields,
      }),
    )
    .describe("Problems with this kit that builders actually hit. Empty array if none were found."),
  tips: z
    .array(
      z.object({
        tip: z.string().describe("The advice, e.g. 'the decals are thick — Mark Softer twice'"),
        category: z.string().describe("prep, paint, decals, assembly, tools or reference"),
        ...ClaimFields,
      }),
    )
    .describe("Build advice for this kit, as opposed to defects. Empty array if none were found."),
});

export type RawKitResearch = z.infer<typeof KitResearchSchema>;

// ---------------------------------------------------------------------------
// Normalisation — where §5.4 is actually enforced
// ---------------------------------------------------------------------------

export interface ResearchClaim {
  /** The claim itself — an issue or a tip, depending on which list it's in. */
  text: string;
  /** Severity for an issue, category for a tip; already coerced to a label. */
  label: string;
  /** Kept for ordering, never rendered as a number. */
  rank: number;
  sourceUrl: string;
  confidence: number;
}

export interface NormalizedResearch {
  difficulty: string | null;
  difficultyNote: string | null;
  fitIssues: Array<{ issue: string; severity: string; sourceUrl: string; confidence: number }>;
  tips: Array<{ tip: string; category: string; sourceUrl: string; confidence: number }>;
}

/** A claim's source has to be a real, public http(s) URL to be a source at
 * all. This is not SSRF defence — nothing here is fetched (`box-art.ts` is
 * where that lives) — it is the §5.4 rule: a link the reader can click and
 * judge for themselves, or the claim doesn't ship. */
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

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function trimText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * A few off-vocabulary words worth catching rather than falling through to the
 * generic label — these are what a model reaches for when it isn't given the
 * list verbatim, and mapping them costs nothing.
 */
const SEVERITY_ALIASES: Record<string, IssueSeverity> = {
  low: "minor",
  small: "minor",
  medium: "moderate",
  significant: "major",
  high: "major",
  severe: "major",
};

function coerceSeverity(raw: unknown): IssueSeverity {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (isIssueSeverity(value)) return value;
  return SEVERITY_ALIASES[value] ?? "moderate";
}

function coerceCategory(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return isTipCategory(value) ? value : "reference";
}

/** No single kit needs more than this to be worth reading, and a run that
 * returns forty tips has stopped being useful anyway. Highest confidence
 * first, so a cap trims the weakest rather than an arbitrary tail. */
const MAX_CLAIMS = 12;

/**
 * Coerces stage C's answer into what the database stores, dropping every claim
 * that can't carry a source. That drop is the point: §5.4 says no unsourced
 * assertion appears as fact, and enforcing it here — rather than hoping each
 * component remembers to check — means a future screen that renders these rows
 * inherits the rule for free.
 */
export function normalizeResearch(raw: RawKitResearch): NormalizedResearch {
  const fitIssues = raw.fitIssues
    .map((row) => {
      const issue = trimText(row.issue, 500);
      const sourceUrl = usableSourceUrl(row.sourceUrl);
      if (!issue || !sourceUrl) return null;
      return { issue, severity: coerceSeverity(row.severity), sourceUrl, confidence: clampConfidence(row.confidence) };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity as IssueSeverity] - SEVERITY_RANK[b.severity as IssueSeverity] ||
        b.confidence - a.confidence,
    )
    .slice(0, MAX_CLAIMS);

  const tips = raw.tips
    .map((row) => {
      const tip = trimText(row.tip, 500);
      const sourceUrl = usableSourceUrl(row.sourceUrl);
      if (!tip || !sourceUrl) return null;
      return { tip, category: coerceCategory(row.category), sourceUrl, confidence: clampConfidence(row.confidence) };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_CLAIMS);

  const difficulty =
    typeof raw.difficulty === "string" && isResearchDifficulty(raw.difficulty.trim().toLowerCase())
      ? raw.difficulty.trim().toLowerCase()
      : null;

  return {
    difficulty,
    // A note with no difficulty behind it is a bare assertion with nothing to
    // qualify it, which is the shape §5.4 exists to prevent.
    difficultyNote: difficulty ? trimText(raw.difficultyNote, 300) : null,
    fitIssues,
    tips,
  };
}

/** Every distinct host the claims and links point at — what `consensusLine`
 * counts. Hosts rather than URLs: three threads on the same forum are one
 * source agreeing with itself, and counting them as three is exactly the
 * false confidence §5.4 is about. */
export function countSources(research: NormalizedResearch): number {
  const hosts = new Set<string>();
  for (const url of [
    ...research.fitIssues.map((r) => r.sourceUrl),
    ...research.tips.map((r) => r.sourceUrl),
  ]) {
    try {
      hosts.add(new URL(url).hostname.replace(/^www\./, ""));
    } catch {
      // Can't happen — `usableSourceUrl` parsed it already — but a research
      // panel is not worth throwing a page over.
    }
  }
  return hosts.size;
}

/** "forums.example.com/thread/12" → "forums.example.com", for the link label
 * beside a claim. The host is what tells you whether to trust it. */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}
