/**
 * The shape of a Tips & Guides page. Guides are hard-coded content compiled
 * into the build — no upload path, no table — on the same rule as the rig and
 * the paint catalogue: they change only on deploy, so a query would buy
 * nothing. Adding a guide is a new file in this folder plus one line in
 * `./index.ts`.
 *
 * The block kinds are the handful the source documents actually use, not a
 * general rich-text model. A new kind earns its place when a guide needs it.
 */

/** A list entry: plain text, or a bold lead-in ("Tack coat:") with optional
 * sub-points under it. */
export type GuideItem = string | { lead?: string; text: string; sub?: string[] };

export type GuideBlock =
  | { kind: "paragraph"; text: string }
  /** Numbered — the order is the instruction. */
  | { kind: "steps"; items: GuideItem[] }
  /** Unordered — a set of things to keep in mind, any order. */
  | { kind: "bullets"; items: GuideItem[] }
  /** The mix/pressure/distance a stage is sprayed at, set apart above its steps. */
  | { kind: "setup"; text: string }
  /** A "why" or "when to skip" aside — reasoning, not instruction. */
  | { kind: "note"; title: string; text?: string; items?: GuideItem[] }
  | { kind: "table"; columns: string[]; rows: string[][] };

export interface GuideSection {
  /** Anchor id for the in-page contents list. */
  id: string;
  /** Small label above the title — "Stage 2". Optional. */
  eyebrow?: string;
  title: string;
  /** One line under the title — the stage's goal. */
  goal?: string;
  blocks: GuideBlock[];
}

export interface Guide {
  slug: string;
  title: string;
  /** Short topic label for cards and the side list — "Airbrush", "Body · 1:24". */
  topic: string;
  /** Spec chips beside the title — the airbrush's nozzle and cup. Optional. */
  specs?: string[];
  /** One or two sentences: what this guide is for. */
  summary: string;
  sections: GuideSection[];
}
