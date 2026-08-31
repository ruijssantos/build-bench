"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { createKitManual, deleteKitManual } from "@/db/repositories/kit-manuals";
import {
  createKit,
  deleteKit,
  findKitByBrandNumber,
  findKitById,
  kitTag,
  KIT_TAG,
  updateKit,
  updateKitImage,
  updateKitPurchase,
  updateKitStatus,
  type KitRow,
} from "@/db/repositories/kits";
import {
  isKitCategory,
  isStashStatus,
  nextStashStatus,
  previousStashStatus,
  statusPhrase,
  type KitStatus,
  type StashStatus,
} from "@/domain/kit";
import type { KitCandidate } from "@/domain/kit-candidate";
import { deleteBoxArt, saveBoxArt } from "@/lib/box-art";
import { readText } from "@/lib/form-text";

/**
 * Kit mutations shared by the Wishlist (Phase 3) and the Stash (Phase 4a) —
 * both screens act on the same `kit` table (docs/PLAN.md §3.3), so the
 * machinery that resolves, saves, edits and re-arts a kit lives here once,
 * generic over `status`, rather than forked per screen. `KitSearch`,
 * `KitCandidateCard` and `ManualKitDialog` (`src/components/wishlist/`,
 * imported cross-folder into both screens) call these directly.
 *
 * Server Actions with `updateTag`, not POST routes — one round trip for the
 * write and the re-render together (docs/PERFORMANCE.md §5). `KIT_TAG`
 * covers every list; `kitTag(id)` additionally covers one kit's own detail
 * page, so editing kit #12 doesn't evict every other kit's cached read.
 */

/** `promotable` is set only when the duplicate is a *wishlist* kit and the
 * caller was saving into the stash — the one direction where offering to move
 * the existing row instead of creating a second one makes sense. */
export type KitResult = { ok: true } | { ok: false; error: string; promotable?: { id: number } };

/**
 * `findKitByBrandNumber` searches every status (docs/PLAN.md §6 Phase 4a), so
 * a duplicate can turn up on either screen. Which of those is worth *offering
 * to promote* is narrower than "any status that isn't the target": only
 * `wishlist → stash` is a promotion.
 *
 * Every other mismatch is just a duplicate to report. In particular a kit
 * already `building` or `built` must never come back as promotable — the
 * caller would render "Promote to Stash" and clicking it would walk a
 * finished kit two rungs *backwards* down the status ladder, which is not a
 * thing this screen should be able to do by accident. Deciding that here,
 * server-side, rather than in each caller's own conditional, is also what
 * keeps a client from asking for it directly.
 */
function duplicateResult(existing: KitRow, targetStatus: KitStatus, brand: string, kitNumber: string): KitResult {
  const error = `${brand} ${kitNumber} is already ${statusPhrase(existing.status)}.`;
  const promotable = targetStatus === "stash" && existing.status === "wishlist";
  return promotable ? { ok: false, error, promotable: { id: existing.id } } : { ok: false, error };
}

// ---------------------------------------------------------------------------
// Save / add / edit
// ---------------------------------------------------------------------------

/**
 * Saves a kit picked from `/api/kits/resolve`'s candidates, into whichever
 * screen called this. Box art is fetched into Blob once, after the response
 * (see the note on the equivalent Phase 3 code this replaces) — the row does
 * not depend on the image, and a slow image host must not hold the save open.
 */
export async function saveKitCandidate(input: KitCandidate, status: KitStatus): Promise<KitResult> {
  const brand = readText(input.brand);
  const name = readText(input.name);
  if (!brand || !name) {
    return { ok: false, error: "That candidate is missing a brand or a name." };
  }

  const kitNumber = readText(input.kitNumber);
  if (kitNumber) {
    const existing = await findKitByBrandNumber(brand, kitNumber);
    if (existing) return duplicateResult(existing, status, brand, kitNumber);
  }

  // The page URL is the fallback, and in practice the usual one — see
  // `saveBoxArt`'s own comment for why a direct image URL rarely arrives.
  const artSources = [readText(input.imageUrl, 2000), readText(input.scalematesUrl, 2000)];

  const id = await createKit({
    brand,
    kitNumber,
    name,
    scale: readText(input.scale, 40),
    category: isKitCategory(input.category) ? input.category : "other",
    status,
    scalematesUrl: readText(input.scalematesUrl, 500),
    imageUrl: null,
    notes: null,
  });

  updateTag(KIT_TAG);

  if (artSources.some(Boolean)) {
    after(() => storeArtAfterResponse(id, artSources));
  }

  return { ok: true };
}

/**
 * The deferred box-art write shared by both save paths.
 *
 * Re-reads the kit's status immediately before writing rather than closing
 * over the status it had when the save returned. `saveBoxArt` can spend up to
 * ~10s per source fetching and uploading, and `updateKitImage` is now scoped
 * by `and(id, status)` — so a kit stashed or advanced during that window would
 * have its art written against a status the row no longer has, match zero
 * rows, and lose the picture silently while leaving the uploaded blob
 * orphaned. Adding the status predicate is what introduced that window; this
 * is what closes it.
 *
 * If the write still misses (the row was deleted, or its status changed inside
 * the remaining gap), the just-uploaded blob is dropped rather than left
 * unreferenced — the same rule `removeKit` follows.
 */
async function storeArtAfterResponse(id: number, sources: Array<string | null>): Promise<void> {
  const art = await saveBoxArt(sources);
  if (!art.ok) return;

  const current = await findKitById(id);
  if (!current) {
    await deleteBoxArt(art.url);
    return;
  }

  const written = await updateKitImage(id, current.status as KitStatus, art.url);
  if (!written) {
    await deleteBoxArt(art.url);
    return;
  }

  updateTag(KIT_TAG);
  updateTag(kitTag(id));
}

export interface AddManualKitInput {
  brand: string;
  kitNumber: string;
  name: string;
  scale: string;
  category: string;
  scalematesUrl: string;
  notes: string;
  /** Either a photo already uploaded to Blob by `/api/kits/upload`, or an
   * image URL typed in by hand — the second gets copied into Blob after the
   * response, the same as a searched kit's box art. */
  imageUrl?: string;
}

/** Manual entry — always available, saving directly into `status`. A photo
 * uploaded through `/api/kits/upload` is already in Blob and is stored
 * as-is; anything else is copied into Blob after the response. */
export async function addManualKit(input: AddManualKitInput, status: KitStatus): Promise<KitResult> {
  const brand = readText(input.brand);
  const name = readText(input.name);
  if (!brand || !name) {
    return { ok: false, error: "Give it at least a brand and a name." };
  }

  const kitNumber = readText(input.kitNumber);
  if (kitNumber) {
    const existing = await findKitByBrandNumber(brand, kitNumber);
    if (existing) return duplicateResult(existing, status, brand, kitNumber);
  }

  const scalematesUrl = readText(input.scalematesUrl, 500);
  const providedImage = readText(input.imageUrl ?? "", 2000);
  const alreadyStored = providedImage?.includes(".blob.vercel-storage.com") ?? false;

  const id = await createKit({
    brand,
    kitNumber,
    name,
    scale: readText(input.scale, 40),
    category: isKitCategory(input.category) ? input.category : "other",
    status,
    scalematesUrl,
    imageUrl: alreadyStored ? providedImage : null,
    notes: readText(input.notes, 2000),
  });

  updateTag(KIT_TAG);

  if (!alreadyStored) {
    const sources = [providedImage, scalematesUrl].filter(Boolean);
    if (sources.length > 0) {
      after(() => storeArtAfterResponse(id, sources));
    }
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
  imageUrl?: string;
}

/** Edits a kit's identity fields in place, whichever screen it's currently
 * on — the row's own `status` (freshly read, never trusted from the client)
 * is what scopes the write. */
export async function updateManualKit(input: UpdateManualKitInput): Promise<KitResult> {
  if (!Number.isInteger(input.id)) return { ok: false, error: "Unknown kit." };

  const brand = readText(input.brand);
  const name = readText(input.name);
  if (!brand || !name) {
    return { ok: false, error: "Give it at least a brand and a name." };
  }

  const existing = await findKitById(input.id);
  if (!existing) return { ok: false, error: "That kit is no longer here." };
  const status = existing.status as KitStatus;

  const kitNumber = readText(input.kitNumber);
  if (kitNumber) {
    const duplicate = await findKitByBrandNumber(brand, kitNumber);
    if (duplicate && duplicate.id !== input.id) return duplicateResult(duplicate, status, brand, kitNumber);
  }

  const newImageUrl = readText(input.imageUrl ?? "", 2000) ?? undefined;
  const scalematesUrl = readText(input.scalematesUrl, 500);

  const updated = await updateKit(input.id, status, {
    brand,
    kitNumber,
    name,
    scale: readText(input.scale, 40),
    category: isKitCategory(input.category) ? input.category : "other",
    scalematesUrl,
    notes: readText(input.notes, 2000),
    imageUrl: newImageUrl,
  });
  if (!updated) return { ok: false, error: "That kit is no longer here." };

  updateTag(KIT_TAG);
  updateTag(kitTag(input.id));

  if (newImageUrl && existing.imageUrl && existing.imageUrl !== newImageUrl) {
    after(() => deleteBoxArt(existing.imageUrl));
  }

  return { ok: true };
}

export type FetchArtResult = { ok: true; imageUrl: string } | { ok: false; error: string };

/** Fetches box art from a kit's link, on demand — synchronous, so the person
 * watches it work and gets the real reason when it doesn't (see the Phase 3
 * note this replaces: sites that refuse server-side requests, Scalemates
 * chief among them, are the expected failure, not an exceptional one). */
export async function fetchKitArt(id: number, linkUrl: string): Promise<FetchArtResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown kit." };

  const link = readText(linkUrl, 2000);
  if (!link) return { ok: false, error: "Add a link first, then fetch." };

  const existing = await findKitById(id);
  if (!existing) return { ok: false, error: "That kit is no longer here." };
  const status = existing.status as KitStatus;

  const art = await saveBoxArt([link]);
  if (!art.ok) return { ok: false, error: art.reason };

  // Checked, not assumed: `updateKitImage` is status-scoped, so a status
  // change between the read above and this write matches zero rows. Reporting
  // success anyway — and then deleting the old blob below — would leave the
  // row pointing at a URL that had just been removed, i.e. a permanently
  // broken image on a card the dialog said it had fixed.
  const written = await updateKitImage(id, status, art.url);
  if (!written) {
    await deleteBoxArt(art.url);
    return { ok: false, error: "That kit changed while the picture was downloading — try again." };
  }

  updateTag(KIT_TAG);
  updateTag(kitTag(id));

  if (existing.imageUrl && existing.imageUrl !== art.url) {
    after(() => deleteBoxArt(existing.imageUrl));
  }

  return { ok: true, imageUrl: art.url };
}

/** Removes a kit, and its box art blob with it. Status-agnostic in: reads
 * the row fresh to learn its current status, then deletes scoped to that —
 * same concurrency-safe shape as every mutation above. */
export async function removeKit(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const existing = await findKitById(id);
  if (!existing) return;

  // `deleteKit` clears the kit's manuals and paint requirements first (see its
  // own note — both reference `kit(id)` with no cascade), and hands back every
  // blob those rows owned so none is left behind: the box art plus one per
  // manual PDF. Before Phase 4a a kit had no children and no blob but its art.
  const removed = await deleteKit(id, existing.status as KitStatus);
  if (!removed) return;

  updateTag(KIT_TAG);
  updateTag(kitTag(id));
  after(async () => {
    await deleteBoxArt(removed.imageUrl);
    for (const url of removed.manualUrls) await deleteBoxArt(url);
  });
}

/**
 * The detail page's Remove — the same deletion as `removeKit`, but it has to
 * leave: the page it was pressed on is that kit's own route, which 404s the
 * moment the row is gone. `redirect` throws by design, so it goes last, after
 * every write and the blob cleanup are queued.
 */
export async function removeKitAndReturn(id: number): Promise<KitResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown kit." };

  const existing = await findKitById(id);
  if (!existing) return { ok: false, error: "That kit is already gone." };

  const removed = await deleteKit(id, existing.status as KitStatus);
  if (!removed) return { ok: false, error: "That kit is already gone." };

  updateTag(KIT_TAG);
  updateTag(kitTag(id));
  after(async () => {
    await deleteBoxArt(removed.imageUrl);
    for (const url of removed.manualUrls) await deleteBoxArt(url);
  });

  redirect("/kits");
}

// ---------------------------------------------------------------------------
// Status — the Stash's own ladder (stash → building → built)
// ---------------------------------------------------------------------------

/** The list card's one-tap advance, and the detail page's primary status
 * button — one hop at a time, matching `updateKitStatus(id, from, to)`'s own
 * shape. Stamps `started_at`/`completed_at` (see `updateKitStatus`). */
export async function advanceKitStatus(id: number, from: StashStatus): Promise<KitResult> {
  const to = nextStashStatus(from);
  if (!to) return { ok: false, error: "This kit is already built." };

  const updated = await updateKitStatus(id, from, to);
  if (!updated) return { ok: false, error: "That kit has moved on already — refresh and try again." };

  updateTag(KIT_TAG);
  updateTag(kitTag(id));
  return { ok: true };
}

/** The stepper's quiet "move back" link. Never reaches `wishlist` — that
 * direction is Phase 3's one-directional "mark bought", not undone here. */
export async function regressKitStatus(id: number, from: StashStatus): Promise<KitResult> {
  const to = previousStashStatus(from);
  if (!to) return { ok: false, error: "This kit can't move back further from here." };

  const updated = await updateKitStatus(id, from, to);
  if (!updated) return { ok: false, error: "That kit has moved on already — refresh and try again." };

  updateTag(KIT_TAG);
  updateTag(kitTag(id));
  return { ok: true };
}

/**
 * What a duplicate-add's "Promote to Stash" button calls — the same
 * one-column `status` write as every transition here, just named for what the
 * person watching it actually asked for.
 *
 * Hardcodes `wishlist → stash` rather than taking a `from` status from the
 * caller: that is the only promotion this app has (§3.3), and accepting the
 * source status as a parameter meant a client could name `built` and quietly
 * walk a finished kit backwards. `duplicateResult` above only ever offers this
 * for a wishlist row, and this refuses anything else regardless.
 */
export async function promoteKitToStash(id: number): Promise<KitResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown kit." };

  const updated = await updateKitStatus(id, "wishlist", "stash");
  if (!updated) return { ok: false, error: "That kit isn't on the wishlist any more — refresh and try again." };

  updateTag(KIT_TAG);
  updateTag(kitTag(id));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Purchase & dates
// ---------------------------------------------------------------------------

export interface UpdateKitPurchaseActionInput {
  id: number;
  purchasedFrom: string;
  /** `<input type="date">` values — "YYYY-MM-DD" or "" for unset. */
  purchasedAt: string;
  startedAt: string;
  completedAt: string;
}

/** The detail page's Purchase & dates edit — also the backfill/correction
 * path for the dates `advanceKitStatus` stamps automatically. */
export async function updateKitPurchaseAction(input: UpdateKitPurchaseActionInput): Promise<KitResult> {
  if (!Number.isInteger(input.id)) return { ok: false, error: "Unknown kit." };

  const existing = await findKitById(input.id);
  if (!existing || !isStashStatus(existing.status)) {
    return { ok: false, error: "That kit is no longer in the stash." };
  }

  const updated = await updateKitPurchase(input.id, existing.status, {
    purchasedFrom: readText(input.purchasedFrom, 200),
    purchasedAt: readText(input.purchasedAt, 10),
    startedAt: readText(input.startedAt, 10),
    completedAt: readText(input.completedAt, 10),
  });
  if (!updated) return { ok: false, error: "That kit is no longer in the stash." };

  updateTag(KIT_TAG);
  updateTag(kitTag(input.id));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Manuals
// ---------------------------------------------------------------------------

export interface CreateManualInput {
  kitId: number;
  blobUrl: string;
  filename: string;
  label: string;
  sizeBytes: number;
}

/**
 * Writes the `kit_manual` row after the client's own `upload()` call has
 * already put the file in Blob (docs/PLAN.md §6 Phase 4a, §4.3) — not from
 * Blob's `onUploadCompleted` callback, which needs a public URL and never
 * fires against a local dev server. This is that Server Action.
 */
export async function createManualForKit(input: CreateManualInput): Promise<KitResult> {
  if (!Number.isInteger(input.kitId)) return { ok: false, error: "Unknown kit." };

  const existing = await findKitById(input.kitId);
  if (!existing) return { ok: false, error: "That kit is no longer here." };

  const blobUrl = readText(input.blobUrl, 2000);
  if (!blobUrl) return { ok: false, error: "That upload didn't come through — try again." };

  await createKitManual({
    kitId: input.kitId,
    blobUrl,
    filename: readText(input.filename, 300),
    label: readText(input.label, 60),
    sizeBytes: Number.isFinite(input.sizeBytes) ? Math.round(input.sizeBytes) : null,
  });

  updateTag(kitTag(input.kitId));
  return { ok: true };
}

/** Removes a manual and its blob — the row is the only reference to it. */
export async function deleteManual(manualId: number, kitId: number): Promise<KitResult> {
  if (!Number.isInteger(manualId) || !Number.isInteger(kitId)) return { ok: false, error: "Unknown manual." };

  const removed = await deleteKitManual(manualId, kitId);
  if (!removed) return { ok: false, error: "That manual is already gone." };

  updateTag(kitTag(kitId));
  after(() => deleteBoxArt(removed.blobUrl));
  return { ok: true };
}
