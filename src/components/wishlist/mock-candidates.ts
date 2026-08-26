import type { KitCandidate } from "@/domain/kit-candidate";

/**
 * TEMPORARY — six dummy candidates for tweaking the Kits UI's look and feel
 * without spending on real `/api/kits/resolve` calls. Delete this file and
 * the `SHOW_MOCK_CANDIDATES` block in `KitSearch.tsx` once that pass is done.
 *
 * One of each category, plus three edge cases worth seeing while tweaking:
 * a name long enough to hit the two-line clamp (#5), a candidate with no
 * kit number or Scalemates link (#6), a box-art link that 404s so you can
 * see `KitArt`'s fallback glyph (#5), and a candidate with no image at all
 * (#6) — both of those are real, expected states, not bugs.
 */
export const MOCK_CANDIDATES: KitCandidate[] = [
  {
    brand: "Tamiya",
    kitNumber: "24345",
    name: "Nissan Skyline GT-R (R34) V-Spec II",
    scale: "1:24",
    category: "cars",
    scalematesUrl: "https://www.scalemates.com/kits/tamiya-24345-nissan-skyline-gt-r-r34-v-spec-ii--1071696.htm",
    imageUrl: "https://picsum.photos/seed/wishlist-mock-1/480/360",
  },
  {
    brand: "Revell",
    kitNumber: "07940",
    name: "BMW R nineT Scrambler",
    scale: "1:12",
    category: "motorcycles",
    scalematesUrl: "https://www.scalemates.com/kits/revell-07940-bmw-r-ninet-scrambler--1105432.htm",
    imageUrl: "https://picsum.photos/seed/wishlist-mock-2/480/360",
  },
  {
    brand: "Airfix",
    kitNumber: "A05135",
    name: "Supermarine Spitfire Mk.Vb",
    scale: "1:48",
    category: "aircraft",
    scalematesUrl: "https://www.scalemates.com/kits/airfix-a05135-supermarine-spitfire-mk-vb--912345.htm",
    imageUrl: "https://picsum.photos/seed/wishlist-mock-3/480/360",
  },
  {
    brand: "Tamiya",
    kitNumber: "35359",
    name: "German Tiger I Tank, Late Production",
    scale: "1:35",
    category: "armour",
    scalematesUrl: "https://www.scalemates.com/kits/tamiya-35359-tiger-i-late-production--845201.htm",
    imageUrl: "https://picsum.photos/seed/wishlist-mock-4/480/360",
  },
  {
    brand: "Trumpeter",
    kitNumber: "05785",
    name: "USS Arizona Battleship Pearl Harbor Memorial Edition with Full Hull",
    scale: "1:200",
    category: "ships",
    scalematesUrl: "https://www.scalemates.com/kits/trumpeter-05785-uss-arizona--765432.htm",
    // Deliberately a dead link — this is what a candidate with a bad or
    // expired box-art URL renders as (KitArt's onError fallback).
    imageUrl: "https://example.com/no-such-image.jpg",
  },
  {
    brand: "Bandai",
    kitNumber: null,
    name: "RG 1/144 Nu Gundam",
    scale: "1:144",
    category: "figures",
    // Deliberately null, both fields — real search results are sometimes
    // this sparse, and the card needs to hold up without them.
    scalematesUrl: null,
    imageUrl: null,
  },
];
