"use server";

import { updateTag } from "next/cache";

import { getCataloguePaint } from "@/catalogue/paints";
import { createOverride, overrideTag } from "@/db/repositories/ratio-overrides";
import { normalizePaintCode } from "@/domain/paint-code";

export interface SaveOverrideInput {
  code: string;
  paintParts: number;
  thinnerParts: number;
  reason?: string;
}

export type SaveOverrideResult = { ok: true } | { ok: false; error: string };

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Saves a ratio correction.
 *
 * A Server Action rather than the POST route it replaces: the mutation and the
 * re-render travel in one round trip instead of two, and `updateTag` gives
 * read-your-own-writes on the cached override without dropping anything else.
 */
export async function saveRatioOverride(input: SaveOverrideInput): Promise<SaveOverrideResult> {
  const code = normalizePaintCode(input.code);

  if (!getCataloguePaint(code)) {
    return { ok: false, error: "Only a catalogued paint code can be corrected." };
  }
  if (!isPositive(input.paintParts) || !isPositive(input.thinnerParts)) {
    return { ok: false, error: "Enter two positive numbers." };
  }

  const reason = input.reason?.trim();
  await createOverride({
    paintCode: code,
    paintParts: input.paintParts,
    thinnerParts: input.thinnerParts,
    reason: reason ? reason : null,
  });

  updateTag(overrideTag(code));
  return { ok: true };
}
