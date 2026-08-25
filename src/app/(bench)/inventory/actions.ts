"use server";

import { updateTag } from "next/cache";

import { getCataloguePaint } from "@/catalogue/paints";
import {
  createInventoryItem,
  deleteInventoryItem,
  findInventoryItem,
  getInventoryItemById,
  inventoryPaintTag,
  INVENTORY_TAG,
  updateInventoryItem,
} from "@/db/repositories/inventory";
import { normalizePaintCode } from "@/domain/paint-code";
import {
  isInventoryForm,
  isInventoryState,
  toggledLowState,
  type InventoryForm,
  type InventoryState,
} from "@/domain/inventory";

/**
 * Inventory mutations — Server Actions rather than POST routes, for the reason
 * in docs/PERFORMANCE.md §5: the write and the re-render travel in one round
 * trip, and `updateTag` gives read-your-own-writes on the cached shelf.
 *
 * Two tags every time. `INVENTORY_TAG` covers the grid, the colour chips and
 * the filter counts, which all read the one list; `inventoryPaintTag(code)`
 * covers the Thinner Bench's ownership chip for that code alone.
 */

export type InventoryResult = { ok: true } | { ok: false; error: string };

function invalidate(paintCode: string): void {
  updateTag(INVENTORY_TAG);
  updateTag(inventoryPaintTag(paintCode));
}

function readQuantity(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 999) return null;
  return value;
}

function readText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

export interface AddInventoryItemInput {
  code: string;
  form: string;
  state?: string | null;
  quantity?: number;
  notes?: string | null;
}

export async function addInventoryItem(input: AddInventoryItemInput): Promise<InventoryResult> {
  const code = normalizePaintCode(input.code);

  // The catalogue is the gate, not the `paint` table: the foreign key would
  // reject an unknown code anyway, but a message naming the problem beats a
  // constraint violation, and this costs a Map hit.
  if (!getCataloguePaint(code)) {
    return { ok: false, error: "That isn't a Tamiya code the catalogue knows." };
  }
  if (!isInventoryForm(input.form)) {
    return { ok: false, error: "Pick a bottle, spray can or decanted jar." };
  }
  if (input.state != null && !isInventoryState(input.state)) {
    return { ok: false, error: "That isn't a bottle state." };
  }

  const quantity = readQuantity(input.quantity ?? 1);
  if (quantity === null) {
    return { ok: false, error: "Quantity has to be a whole number, 1 or more." };
  }

  const clash = await findInventoryItem(code, input.form);
  if (clash) {
    return {
      ok: false,
      error: `${code} is already on the shelf as a ${input.form.replace("_", " ")} — edit that row instead.`,
    };
  }

  await createInventoryItem({
    paintCode: code,
    form: input.form as InventoryForm,
    state: (input.state as InventoryState | null) ?? null,
    quantity,
    notes: readText(input.notes),
  });

  invalidate(code);
  return { ok: true };
}

export interface EditInventoryItemInput {
  id: number;
  form: string;
  state?: string | null;
  quantity?: number;
  notes?: string | null;
}

export async function editInventoryItem(input: EditInventoryItemInput): Promise<InventoryResult> {
  if (!Number.isInteger(input.id)) return { ok: false, error: "Unknown shelf entry." };
  if (!isInventoryForm(input.form)) {
    return { ok: false, error: "Pick a bottle, spray can or decanted jar." };
  }
  if (input.state != null && !isInventoryState(input.state)) {
    return { ok: false, error: "That isn't a bottle state." };
  }

  const quantity = readQuantity(input.quantity ?? 1);
  if (quantity === null) {
    return { ok: false, error: "Quantity has to be a whole number, 1 or more." };
  }

  const updated = await updateInventoryItem(input.id, {
    form: input.form as InventoryForm,
    state: (input.state as InventoryState | null) ?? null,
    quantity,
    notes: readText(input.notes),
  });
  if (!updated) return { ok: false, error: "That shelf entry is gone." };

  invalidate(updated.paintCode);
  return { ok: true };
}

export async function removeInventoryItem(id: number): Promise<InventoryResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Unknown shelf entry." };

  const removed = await deleteInventoryItem(id);
  if (!removed) return { ok: false, error: "That shelf entry is gone." };

  invalidate(removed.paintCode);
  return { ok: true };
}

/**
 * The one-tap running-low mark.
 *
 * A `<form action={…}>` submit handler rather than an onClick, which is why
 * the shelf grid ships no client JavaScript at all: the button is server-
 * rendered, the toggle works before (and without) hydration, and the response
 * is the re-rendered row.
 */
export async function toggleRunningLow(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const item = await getInventoryItemById(id);
  if (!item) return;

  const updated = await updateInventoryItem(id, { state: toggledLowState(item.state) });
  if (updated) invalidate(updated.paintCode);
}

/**
 * The one-click remove icon in the table row. Same shape as
 * `toggleRunningLow` above — a plain form action, no client JavaScript, no
 * confirmation step. `EditItemDialog`'s own two-tap Remove is the deliberate
 * path for when you want to double-check first; this is the fast one.
 */
export async function removeInventoryItemAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const removed = await deleteInventoryItem(id);
  if (removed) invalidate(removed.paintCode);
}
