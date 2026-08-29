"use server";

import { updateTag } from "next/cache";
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
  statusLabel,
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

export type KitResult = { ok: true } | { ok: false; error: string; existing?: { id: number; status: KitStatus } };

function statusPhrase(status: string): string {
  return status === "wishlist" ? "on your wishlist" : `in your ${statusLabel(status).toLowerCase()}`;
}

/**
 * `findKitByBrandNumber` searches every status (docs/PLAN.md §6 Phase 4a) —
 * a hit outside the status being saved into is offered back as something to
 * *promote* rather than a second row. `existing` carries what a caller needs
 * to offer that: the row's id and its actual status, to hand to
 * `promoteKitToStash` (or, symmetrically, any future generalisation of it).
 */
function duplicateResult(existing: KitRow, targetStatus: KitStatus, brand: string, kitNumber: string): KitResult {
  if (existing.status === targetStatus) {
    return { ok: false, error: `${brand} ${kitNumber} is already ${statusPhrase(targetStatus)}.` };
  }
  return {
    ok: false,
    error: `${brand} ${kitNumber} is already ${statusPhrase(existing.status)}.`,
    existing: { id: existing.id, status: existing.status as KitStatus },
  };
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
    after(async () => {
      const art = await saveBoxArt(artSources);
      if (!art.ok) return;
      await updateKitImage(id, status, art.url);
      updateTag(KIT_TAG);
      updateTag(kitTag(id));
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
      after(async () => {
        const art = await saveBoxArt(sources);
        if (!art.ok) return;
        await updateKitImage(id, status, art.url);
        updateTag(KIT_TAG);
        updateTag(kitTag(id));
      });
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

  await updateKitImage(id, status, art.url);
  updateTag(KIT_TAG);
  updateTag(kitTag(id));

  if (existing.imageUrl && existing.imageUrl !== art.url) {
    after(() => deleteBoxArt(existing.imageUrl));
  }

  return { ok: true, imageUrl: art.url };
}

/**
 * The detail page's art-only edit — a photo already uploaded via
 * `/api/kits/upload`, or a pasted link fetched synchronously. Split from
 * `updateManualKit` on purpose (docs/PLAN.md §6 Phase 4a): this is the one
 * call site the plan flags as the reason `updateKitImage` needed its status
 * predicate fixed, and it changes exactly one field — no reason to route it
 * through the full identity-edit form.
 */
export async function updateKitArt(id: number, imageUrl: string, alreadyStored: boolean): Promise<KitResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown kit." };
  const link = readText(imageUrl, 2000);
  if (!link) return { ok: false, error: "Choose a photo or paste an image address first." };

  const existing = await findKitById(id);
  if (!existing) return { ok: false, error: "That kit is no longer here." };
  const status = existing.status as KitStatus;

  const art = alreadyStored ? ({ ok: true, url: link } as const) : await saveBoxArt([link]);
  if (!art.ok) return { ok: false, error: art.reason };

  const updated = await updateKitImage(id, status, art.url);
  if (!updated) return { ok: false, error: "That kit is no longer here." };

  updateTag(KIT_TAG);
  updateTag(kitTag(id));

  if (existing.imageUrl && existing.imageUrl !== art.url) {
    after(() => deleteBoxArt(existing.imageUrl));
  }

  return { ok: true };
}

/** Removes a kit, and its box art blob with it. Status-agnostic in: reads
 * the row fresh to learn its current status, then deletes scoped to that —
 * same concurrency-safe shape as every mutation above. */
export async function removeKit(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const existing = await findKitById(id);
  if (!existing) return;

  const removed = await deleteKit(id, existing.status as KitStatus);
  if (!removed) return;

  updateTag(KIT_TAG);
  updateTag(kitTag(id));
  after(() => deleteBoxArt(removed.imageUrl));
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

/** What a duplicate-add's "Promote to Stash" button calls — the same
 * one-column `status` write as every transition here, just named for what
 * the person watching it actually asked for. */
export async function promoteKitToStash(id: number, fromStatus: KitStatus): Promise<KitResult> {
  const updated = await updateKitStatus(id, fromStatus, "stash");
  if (!updated) return { ok: false, error: "That kit has moved on already — refresh and try again." };

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
