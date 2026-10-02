import { AIRBRUSH_GUIDE } from "./airbrush";
import { BODY_PAINTING_GUIDE } from "./body-painting";
import type { Guide } from "./types";

export type { Guide, GuideBlock, GuideItem, GuideSection } from "./types";

/** Every guide, in the order the Tips & Guides list shows them. */
export const GUIDES: Guide[] = [AIRBRUSH_GUIDE, BODY_PAINTING_GUIDE];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
