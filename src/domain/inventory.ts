/**
 * Pure inventory vocabulary — docs/PLAN.md §3.2.
 *
 * The schema stores `form` and `state` as free text with the allowed values
 * in a comment. These are the only places those strings are turned into
 * anything a human reads, so a typo shows up as a wrong label rather than as
 * a silently-unfiltered row.
 *
 * No data, no I/O: the repository, the server actions and the UI all agree on
 * the same vocabulary by importing it from here.
 */

export const INVENTORY_FORMS = ["bottle", "spray_can", "decanted_jar"] as const;
export type InventoryForm = (typeof INVENTORY_FORMS)[number];

/**
 * Two explicit states, plus the unset default — trimmed from an original
 * four (sealed/open/low/empty) at the owner's request: sealed adds nothing
 * over the unset default, and empty adds nothing over just removing the row.
 */
export const INVENTORY_STATES = ["open", "low"] as const;
export type InventoryState = (typeof INVENTORY_STATES)[number];

export function isInventoryForm(value: unknown): value is InventoryForm {
  return typeof value === "string" && (INVENTORY_FORMS as readonly string[]).includes(value);
}

export function isInventoryState(value: unknown): value is InventoryState {
  return typeof value === "string" && (INVENTORY_STATES as readonly string[]).includes(value);
}

const FORM_LABEL: Record<InventoryForm, string> = {
  bottle: "bottle",
  spray_can: "spray can",
  decanted_jar: "decanted jar",
};

/** Lower case — this is how a form reads inline, in a spec line like
 * "10 ml bottle" or "100 ml spray can". For the standalone segmented-control
 * label, see `formLabelTitleCase`. */
export function formLabel(form: string | null): string {
  return isInventoryForm(form) ? FORM_LABEL[form] : "unrecorded";
}

/** "Bottle", "Spray Can", "Decanted Jar" — Title Case, matching
 * `stateLabel`'s "In Stock" / "Open" / "Low" on the same Add/Edit form. Only
 * the standalone Form control wants this; every other use of `formLabel` is
 * inline body copy, where lower case reads naturally. */
export function formLabelTitleCase(form: string | null): string {
  return formLabel(form)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * `null` reads as "In Stock", not "Unknown": a row exists because the paint is
 * on the shelf. State refines *how much* is left, and the sheet this was
 * imported from (§2.1) carried no such column — so an un-set state means
 * nobody has said otherwise, which is exactly "in stock".
 */
const STATE_LABEL: Record<InventoryState, string> = {
  open: "Open",
  low: "Low",
};

export function stateLabel(state: string | null): string {
  return isInventoryState(state) ? STATE_LABEL[state] : "In Stock";
}

export function isRunningLow(state: string | null): boolean {
  return state === "low";
}

/** What a "Running low" toggle flips to. Clearing `low` lands on `open`,
 * because a bottle you have just topped up your opinion of is, by definition,
 * one you have opened. */
export function toggledLowState(state: string | null): InventoryState {
  return isRunningLow(state) ? "open" : "low";
}

/** Pill labels for the family filters. `familyLabel` in the Thinner Bench
 * spells the full "Acrylic · flat" identity, which is too long for a filter
 * chip — these are the same families, named short. */
const FAMILY_CHIP_LABEL: Record<string, string> = {
  gloss: "Gloss",
  flat: "Flat",
  semi: "Semi-gloss",
  metallic: "Metallic",
  clear: "Clear",
  lacquer: "Lacquer",
  sprayDecant: "Spray",
  polycarb: "Polycarbonate",
  enamel: "Enamel",
  primer: "Primer",
  additive: "Additive",
};

export function familyChipLabel(family: string | null): string {
  if (!family) return "Unfiled";
  return FAMILY_CHIP_LABEL[family] ?? family;
}

/**
 * "2 days ago", "Last week" — the design reference's own phrasing for the
 * Recently sprayed strip. Takes `now` as an argument rather than reading the
 * clock, so it stays pure and testable.
 */
export function relativeDayLabel(when: Date, now: Date): string {
  const days = Math.floor((now.getTime() - when.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return when.toISOString().slice(0, 10);
}

/**
 * The "find somewhere that sells this" link.
 *
 * A plain Google search rather than a vendor deep-link on purpose: the app
 * carries no pricing and no stock data (§8), and the shops worth checking
 * differ per paint and per week. Handing the query to a search engine is the
 * honest version of that, and it costs no integration to maintain.
 */
export function paintSearchUrl(code: string, name: string | null): string {
  const query = ["Tamiya", code, name ?? ""].filter(Boolean).join(" ").trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
