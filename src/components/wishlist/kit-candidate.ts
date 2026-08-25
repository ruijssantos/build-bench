/** The shape `/api/kits/resolve` returns a candidate as — docs/PLAN.md §5.1.
 * Its own module so both the search state (`KitSearch`) and the card
 * (`KitCandidateCard`) import one definition rather than each other. */
export interface KitCandidate {
  brand: string;
  kitNumber: string;
  name: string;
  scale: string;
  category: string;
  scalematesUrl: string | null;
  imageUrl: string | null;
}
