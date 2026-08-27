"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";

import {
  createKit,
  deleteKit,
  findKitById,
  findWishlistKit,
  KIT_TAG,
  updateKit,
  updateKitImage,
  updateKitStatus,
} from "@/db/repositories/kits";
import {
  createWishlistItem,
  deleteWishlistItem,
  updateWishlistItemStatus,
  WISHLIST_ITEMS_TAG,
} from "@/db/repositories/wishlist-items";
import { isKitCategory } from "@/domain/kit";
import type { KitCandidate } from "@/domain/kit-candidate";
import { deleteBoxArt, saveBoxArt } from "@/lib/box-art";

/**
 * Wishlist mutations — Server Actions with `updateTag`, not POST routes, for
 * the reason in docs/PERFORMANCE.md §5: the write and the re-render travel
 * in one round trip. The paid, slow part of this screen (resolving a search)
 * is the one exception — that's `/api/kits/resolve`, a real search endpoint,
 * not a mutation.
 */

export type WishlistResult = { ok: true } | { ok: false; error: string };

function readText(raw: unknown, maxLen = 200): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

// ---------------------------------------------------------------------------
// Kits
// ---------------------------------------------------------------------------

/**
 * Saves a kit picked from `/api/kits/resolve`'s candidates.
 *
 * Box art is fetched into Blob once, at save time (docs/PLAN.md §2.4) — but
 * *after* the response, not inside it. The row does not depend on the image,
 * and a slow or hanging image host would otherwise hold the user's save open
 * for the full 10s fetch timeout plus the upload, on a screen whose every
 * other mutation is one fast round trip. `after()` runs the fetch once the
 * response is done and patches `image_url` in, re-tagging so the grid picks
 * the art up on the next read.
 */
export async function saveKitCandidate(input: KitCandidate): Promise<WishlistResult> {
  const brand = readText(input.brand);
  const name = readText(input.name);
  if (!brand || !name) {
    return { ok: false, error: "That candidate is missing a brand or a name." };
  }

  const kitNumber = readText(input.kitNumber);

  // Same guard as the shelf's "already on the shelf as a bottle" — saving the
  // same kit from two searches is the same mistake, and the wishlist should
  // answer it the same way rather than growing a duplicate card.
  if (kitNumber) {
    const existing = await findWishlistKit(brand, kitNumber);
    if (existing) {
      return { ok: false, error: `${brand} ${kitNumber} is already on the wishlist.` };
    }
  }

  // The page URL is the fallback, and in practice the usual one: a web
  // search can rarely name a direct image file, but it can almost always
  // name the kit's page, and `saveBoxArt` reads the art off that page's
  // Open Graph tag. Before this fallback existed a candidate with no
  // `imageUrl` saved with no art and no way to ever get any.
  const artSources = [readText(input.imageUrl, 2000), readText(input.scalematesUrl, 2000)];

  const id = await createKit({
    brand,
    kitNumber,
    name,
    scale: readText(input.scale, 40),
    category: isKitCategory(input.category) ? input.category : "other",
    status: "wishlist",
    scalematesUrl: readText(input.scalematesUrl, 500),
    imageUrl: null,
    notes: null,
  });

  updateTag(KIT_TAG);

  if (artSources.some(Boolean)) {
    after(async () => {
      const art = await saveBoxArt(artSources);
      if (!art.ok) return;
      await updateKitImage(id, art.url);
      updateTag(KIT_TAG);
    });
  }

  return { ok: true };
}

export interface AddManualKitInput {
  brand: string;
  kitNumber: string;
  name: string;
  scale: string;
  category: string;
  scalematesUrl: string;
  notes: string;
}

/** Manual entry — always available, never gated behind a failed search
 * (docs/PLAN.md §6 Phase 3). If a link was filled in, the same Open Graph
 * read a searched kit gets runs against it after the response: typing a
 * retailer URL is enough to get the box art, with no photo to upload and
 * nothing else to do. Without one the card shows the fallback glyph. */
export async function addManualKit(input: AddManualKitInput): Promise<WishlistResult> {
  const brand = readText(input.brand);
  const name = readText(input.name);
  if (!brand || !name) {
    return { ok: false, error: "Give it at least a brand and a name." };
  }

  const scalematesUrl = readText(input.scalematesUrl, 500);

  const id = await createKit({
    brand,
    kitNumber: readText(input.kitNumber),
    name,
    scale: readText(input.scale, 40),
    category: isKitCategory(input.category) ? input.category : "other",
    status: "wishlist",
    scalematesUrl,
    imageUrl: null,
    notes: readText(input.notes, 2000),
  });

  updateTag(KIT_TAG);

  if (scalematesUrl) {
    after(async () => {
      const art = await saveBoxArt([scalematesUrl]);
      if (!art.ok) return;
      await updateKitImage(id, art.url);
      updateTag(KIT_TAG);
    });
  }

  return { ok: true };
}

export interface UpdateManualKitInput {
  id: number;
  brand: string;
  kitNumber: string;
  name: string;
  scale: string;
  category: string;
  scalematesUrl: string;
  notes: string;
  /** Set only when the edit uploaded a new photo (`ManualKitDialog`'s upload
   * runs before this action is called, same reasoning as `saveKitCandidate`
   * not fetching box art inline — the row itself never blocks on Blob). */
  imageUrl?: string;
}

/** Edits a kit already on the wishlist — the same fields `addManualKit`
 * takes, plus the id and an optional new photo. Reuses `findWishlistKit`'s
 * duplicate guard, excluding the kit being edited itself so saving with its
 * own brand and number unchanged doesn't trip over its own row. */
export async function updateManualKit(input: UpdateManualKitInput): Promise<WishlistResult> {
  if (!Number.isInteger(input.id)) return { ok: false, error: "Unknown kit." };

  const brand = readText(input.brand);
  const name = readText(input.name);
  if (!brand || !name) {
    return { ok: false, error: "Give it at least a brand and a name." };
  }

  const existing = await findKitById(input.id, "wishlist");
  if (!existing) return { ok: false, error: "That kit is no longer on the wishlist." };

  const kitNumber = readText(input.kitNumber);
  if (kitNumber) {
    const duplicate = await findWishlistKit(brand, kitNumber);
    if (duplicate && duplicate.id !== input.id) {
      return { ok: false, error: `${brand} ${kitNumber} is already on the wishlist.` };
    }
  }

  const newImageUrl = readText(input.imageUrl ?? "", 2000) ?? undefined;
  const scalematesUrl = readText(input.scalematesUrl, 500);

  const updated = await updateKit(input.id, "wishlist", {
    brand,
    kitNumber,
    name,
    scale: readText(input.scale, 40),
    category: isKitCategory(input.category) ? input.category : "other",
    scalematesUrl,
    notes: readText(input.notes, 2000),
    imageUrl: newImageUrl,
  });
  if (!updated) return { ok: false, error: "That kit is no longer on the wishlist." };

  updateTag(KIT_TAG);

  // No silent art backfill here any more. Saving used to quietly re-read the
  // link and hope, which is indistinguishable from doing nothing when the
  // site refuses the request — the user saved, waited, saw no picture and had
  // no way to learn why. `fetchKitArt` below does the same work on an
  // explicit press and reports what actually happened.

  // A replaced photo orphans the old blob unless it's cleaned up — same rule
  // as `removeKitAction`, just triggered by a swap instead of a delete.
  if (newImageUrl && existing.imageUrl && existing.imageUrl !== newImageUrl) {
    after(() => deleteBoxArt(existing.imageUrl));
  }

  return { ok: true };
}

export type FetchArtResult = { ok: true; imageUrl: string } | { ok: false; error: string };

/**
 * Fetches box art from a kit's link, on demand, and says what happened.
 *
 * Deliberately synchronous — the one place in this screen that waits on a
 * third-party host rather than deferring to `after()`. Everywhere else art
 * is a bonus arriving quietly behind a save; here it is the entire point of
 * the press, so the user watches it work and gets the real reason when it
 * doesn't. Sites that refuse server-side requests are the expected failure,
 * not an exceptional one, and "Upload a photo instead" is only useful advice
 * if it actually reaches them.
 */
export async function fetchKitArt(id: number, linkUrl: string): Promise<FetchArtResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown kit." };

  const link = readText(linkUrl, 2000);
  if (!link) return { ok: false, error: "Add a link first, then fetch." };

  const existing = await findKitById(id, "wishlist");
  if (!existing) return { ok: false, error: "That kit is no longer on the wishlist." };

  const art = await saveBoxArt([link]);
  if (!art.ok) return { ok: false, error: art.reason };

  await updateKit(id, "wishlist", {
    brand: existing.brand ?? "",
    kitNumber: existing.kitNumber,
    name: existing.name ?? "",
    scale: existing.scale,
    category: isKitCategory(existing.category) ? existing.category : "other",
    scalematesUrl: existing.scalematesUrl,
    notes: existing.notes,
    imageUrl: art.url,
  });
  updateTag(KIT_TAG);

  // The row it replaced, if any, is now unreferenced.
  if (existing.imageUrl && existing.imageUrl !== art.url) {
    after(() => deleteBoxArt(existing.imageUrl));
  }

  return { ok: true, imageUrl: art.url };
}

/** The kit card's "Mark bought" tick — `status: wishlist → stash` (§3.3).
 * One-directional from this screen on purpose: buying a kit is a real event,
 * and the row it lands on is exactly where Phase 4's stash picks it up.
 *
 * Scoped `wishlist → stash` rather than "set this id to stash": this screen
 * may only move rows it actually shows, so a stale tab can't re-stamp a kit
 * Phase 4 has since marked building or built. */
export async function markKitBought(id: number): Promise<WishlistResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown kit." };

  const updated = await updateKitStatus(id, "wishlist", "stash");
  if (!updated) return { ok: false, error: "That kit is no longer on the wishlist." };

  updateTag(KIT_TAG);
  return { ok: true };
}

/**
 * Removes a wishlist kit, and the box art blob with it — the row is the only
 * reference to that object, so dropping one without the other leaves a
 * permanently public file nothing in the app can reach again.
 *
 * `deleteKit` is scoped to `wishlist`, so this cannot reach a stashed or
 * built kit even with a replayed post carrying its id.
 */
export async function removeKitAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const removed = await deleteKit(id, "wishlist");
  if (!removed) return;

  updateTag(KIT_TAG);
  after(() => deleteBoxArt(removed.imageUrl));
}

// ---------------------------------------------------------------------------
// Other items
// ---------------------------------------------------------------------------

export interface AddWishlistItemInput {
  title: string;
  url: string;
  notes: string;
}

export async function addWishlistItem(input: AddWishlistItemInput): Promise<WishlistResult> {
  const title = readText(input.title);
  if (!title) return { ok: false, error: "Give it a title." };

  await createWishlistItem({
    title,
    url: readText(input.url, 500),
    notes: readText(input.notes, 2000),
  });

  updateTag(WISHLIST_ITEMS_TAG);
  return { ok: true };
}

/** The list row's tick — `status`: wanted ↔ bought. Unlike a kit, this
 * toggles both ways: a tool or a bottle of glue has no ownership record to
 * move it to, so ticking it is a checklist mark, not a state transition. */
export async function toggleWishlistItemBought(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "wanted");
  if (!Number.isInteger(id)) return;

  await updateWishlistItemStatus(id, status === "bought" ? "wanted" : "bought");
  updateTag(WISHLIST_ITEMS_TAG);
}

export async function removeWishlistItemAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await deleteWishlistItem(id);
  updateTag(WISHLIST_ITEMS_TAG);
}
