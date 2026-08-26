"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";

import {
  createKit,
  deleteKit,
  findWishlistKit,
  KIT_TAG,
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

  const sourceImageUrl = readText(input.imageUrl, 2000);

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

  if (sourceImageUrl) {
    after(async () => {
      const imageUrl = await saveBoxArt(sourceImageUrl);
      if (!imageUrl) return;
      await updateKitImage(id, imageUrl);
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
 * (docs/PLAN.md §6 Phase 3). No box art: nothing was resolved to fetch one
 * from, so the card shows the fallback glyph, same as any kit search missed
 * an image for. */
export async function addManualKit(input: AddManualKitInput): Promise<WishlistResult> {
  const brand = readText(input.brand);
  const name = readText(input.name);
  if (!brand || !name) {
    return { ok: false, error: "Give it at least a brand and a name." };
  }

  await createKit({
    brand,
    kitNumber: readText(input.kitNumber),
    name,
    scale: readText(input.scale, 40),
    category: isKitCategory(input.category) ? input.category : "other",
    status: "wishlist",
    scalematesUrl: readText(input.scalematesUrl, 500),
    imageUrl: null,
    notes: readText(input.notes, 2000),
  });

  updateTag(KIT_TAG);
  return { ok: true };
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
