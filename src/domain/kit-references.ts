import { isKitCategory, kitYoutubeSearchUrl, type KitCategory } from "@/domain/kit";

/**
 * The kit page's References: where to look while building — the real thing,
 * and other people's builds of this kit. Plain search links, built from the
 * kit's own fields, so they exist the moment a kit does and cost nothing.
 *
 * What's worth looking at depends on what the kit *is*: a car has a cockpit
 * and an engine bay, a bike has controls and an engine you can see, a tank
 * has running gear. Each category names its own searches; the subject is the
 * kit's name, which for a model kit is the real vehicle ("Lancia Delta S4
 * Martini Monte Carlo Rally 1986").
 */

export interface ReferenceLink {
  label: string;
  /** Where the link goes, for the line under the label. */
  where: "YouTube" | "Google Images";
  /** What's searched for — shown, so a vague kit name is visible as the reason a search is vague. */
  query: string;
  url: string;
}

/** Each search is the subject plus these words; an empty string is the subject alone. */
const SEARCHES: Record<KitCategory, ReadonlyArray<readonly [label: string, words: string]>> = {
  cars: [
    ["Exterior", ""],
    ["Cockpit", "cockpit interior"],
    ["Engine", "engine bay"],
    ["On the road", "race"],
  ],
  motorcycles: [
    ["Exterior", ""],
    ["Engine", "engine"],
    ["Controls", "handlebars dashboard"],
    ["Suspension & exhaust", "suspension exhaust detail"],
    ["Racing", "race"],
  ],
  aircraft: [
    ["Exterior", ""],
    ["Cockpit", "cockpit"],
    ["Engine", "engine"],
    ["Undercarriage", "landing gear wheel well"],
    ["In service", "in service"],
  ],
  armour: [
    ["Exterior", ""],
    ["Interior", "interior"],
    ["Engine deck", "engine deck"],
    ["Running gear", "tracks running gear"],
    ["In service", "in service"],
  ],
  ships: [
    ["Exterior", ""],
    ["Deck detail", "deck detail"],
    ["Superstructure", "superstructure bridge"],
    ["In service", "at sea"],
  ],
  figures: [
    ["Reference", ""],
    ["Uniform", "uniform detail"],
    ["Equipment", "equipment"],
  ],
  other: [["Reference", ""]],
};

/** The subject every search is about: the kit's name, or failing that the
 * brand and number — the same fields its YouTube search is built from. */
function subjectOf(kit: KitLike): string {
  return (kit.name ?? [kit.brand, kit.kitNumber].filter(Boolean).join(" ")).trim();
}

interface KitLike {
  brand: string | null;
  kitNumber: string | null;
  name: string | null;
  category: string | null;
}

function googleImagesUrl(query: string): string {
  return `https://www.google.com/search?udm=2&q=${encodeURIComponent(query)}`;
}

/** Build videos first — the one link that's about this kit rather than the
 * real thing — then the category's photo searches. */
export function referenceLinks(kit: KitLike): ReferenceLink[] {
  const subject = subjectOf(kit);
  const category: KitCategory = isKitCategory(kit.category) ? kit.category : "other";
  const youtubeQuery = [kit.brand, kit.kitNumber, kit.name, "build"].filter(Boolean).join(" ");

  return [
    { label: "Build videos", where: "YouTube", query: youtubeQuery, url: kitYoutubeSearchUrl(kit.brand, kit.kitNumber, kit.name) },
    ...(subject
      ? SEARCHES[category].map(([label, words]) => {
          const query = words ? `${subject} ${words}` : subject;
          return { label, where: "Google Images" as const, query, url: googleImagesUrl(query) };
        })
      : []),
  ];
}

/** Spotmodel, the shop the owner buys from, searched for this kit — its
 * results list the kit's upgrade parts beside it. The kit number is what the
 * shop indexes on; a kit without one falls back to its name. */
export function spotmodelSearchUrl(kit: Pick<KitLike, "kitNumber" | "name">): string | null {
  const keywords = (kit.kitNumber ?? kit.name ?? "").trim();
  if (!keywords) return null;
  return `https://www.spotmodel.com/advanced_search_results.php?keywords=${encodeURIComponent(keywords)}`;
}
