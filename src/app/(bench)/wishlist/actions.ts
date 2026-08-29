"use server";

import { updateTag } from "next/cache";

import { KIT_TAG, updateKitStatus } from "@/db/repositories/kits";
import {
  createWishlistItem,
  deleteWishlistItem,
  updateWishlistItem as updateWishlistItemRow,
  updateWishlistItemStatus,
  WISHLIST_ITEMS_TAG,
} from "@/db/repositories/wishlist-items";
import { readText } from "@/lib/form-text";

/**
 * Wishlist-only mutations — docs/PLAN.md §6 Phase 3.
 *
 * Everything that acts on a `kit` row and isn't specific to this screen
 * (saving a search result, manual entry, editing, box art, removing) now
 * lives in `src/app/(bench)/kits/actions.ts`, generic over `status`, and is
 * imported directly from there by the shared components
 * (`KitCandidateCard`, `ManualKitDialog`, `SavedKitCard`'s Edit/Remove) —
 * see that file's own comment. What's left here is genuinely wishlist-only:
 * the one-directional "mark bought" tick (§3.3) and the Other Items list,
 * which has nothing to do with kits at all.
 */

export type WishlistResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Kits
// ---------------------------------------------------------------------------

/** The kit card's "Stash" tick — `status: wishlist → stash` (§3.3).
 * One-directional from this screen on purpose: buying a kit is a real event,
 * and the row it lands on is exactly where the stash picks it up. Scoped
 * `wishlist → stash` rather than "set this id to stash": this screen may
 * only move rows it actually shows. */
export async function markKitBought(id: number): Promise<WishlistResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown kit." };

  const updated = await updateKitStatus(id, "wishlist", "stash");
  if (!updated) return { ok: false, error: "That kit is no longer on the wishlist." };

  updateTag(KIT_TAG);
  return { ok: true };
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

export interface UpdateWishlistItemInput {
  id: number;
  title: string;
  url: string;
  notes: string;
}

export async function updateWishlistItem(input: UpdateWishlistItemInput): Promise<WishlistResult> {
  if (!Number.isInteger(input.id)) return { ok: false, error: "Unknown item." };

  const title = readText(input.title);
  if (!title) return { ok: false, error: "Give it a title." };

  const updated = await updateWishlistItemRow(input.id, {
    title,
    url: readText(input.url, 500),
    notes: readText(input.notes, 2000),
  });
  if (!updated) return { ok: false, error: "That item is no longer on the list." };

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
