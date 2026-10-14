"use client";

import formStyles from "@/components/inventory/InventoryForm.module.css";
import type { KitRow } from "@/db/repositories/kits";

/** The four Purchase & dates values as the form holds them: plain strings,
 * `<input type="date">` values being "YYYY-MM-DD" or "" for unset. */
export interface PurchaseValues {
  purchasedFrom: string;
  purchasedAt: string;
  startedAt: string;
  completedAt: string;
}

export function purchaseValuesOf(kit: KitRow | undefined): PurchaseValues {
  return {
    purchasedFrom: kit?.purchasedFrom ?? "",
    purchasedAt: kit?.purchasedAt ?? "",
    startedAt: kit?.startedAt ?? "",
    completedAt: kit?.completedAt ?? "",
  };
}

/**
 * Purchased from / on, Started, Completed — the fields behind the kit page's
 * Purchase & dates panel. Shared by that panel's own small dialog
 * (`EditPurchaseDialog`) and the full kit dialog (`ManualKitDialog`), which
 * carries every field a kit has so there's one place to edit all of it.
 *
 * `idPrefix` keeps the inputs' ids unique to whichever dialog renders them.
 */
export function PurchaseFields({
  values,
  onChange,
  disabled,
  idPrefix,
}: {
  values: PurchaseValues;
  onChange: (next: PurchaseValues) => void;
  disabled: boolean;
  idPrefix: string;
}) {
  const set = (key: keyof PurchaseValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...values, [key]: e.target.value });

  return (
    <>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-purchased-from`}>
          Purchased from
        </label>
        <input
          id={`${idPrefix}-purchased-from`}
          className={formStyles.input}
          type="text"
          placeholder="Shop name"
          value={values.purchasedFrom}
          onChange={set("purchasedFrom")}
          disabled={disabled}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-purchased-at`}>
          Purchased on
        </label>
        <input
          id={`${idPrefix}-purchased-at`}
          className={formStyles.input}
          type="date"
          value={values.purchasedAt}
          onChange={set("purchasedAt")}
          disabled={disabled}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-started-at`}>
          Started
        </label>
        <input
          id={`${idPrefix}-started-at`}
          className={formStyles.input}
          type="date"
          value={values.startedAt}
          onChange={set("startedAt")}
          disabled={disabled}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-completed-at`}>
          Completed
        </label>
        <input
          id={`${idPrefix}-completed-at`}
          className={formStyles.input}
          type="date"
          value={values.completedAt}
          onChange={set("completedAt")}
          disabled={disabled}
        />
      </div>
      <span className={formStyles.hint}>
        Started and Completed are stamped automatically when you change the status; this is where to correct or
        backfill them.
      </span>
    </>
  );
}
