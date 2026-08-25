import Link from "next/link";

import { ChevronDownIcon, ExternalLinkIcon, SortIcon } from "@/components/icons";
import type { InventoryItemRow } from "@/db/repositories/inventory";
import {
  familyChipLabel,
  formLabel,
  isInventoryForm,
  isInventoryState,
  isRunningLow,
  paintSearchUrl,
  stateLabel,
} from "@/domain/inventory";

import { EditItemTrigger } from "./EditItemTrigger";
import { LowToggle } from "./LowToggle";
import { RemoveButton } from "./RemoveButton";
import { inventoryHref, nextSortState, type InventoryParams, type SortColumn } from "./inventory-params";
import styles from "./Inventory.module.css";

/**
 * Every paint you own, as a table.
 *
 * A real `<table>` rather than a stack of divs: it is a table, it is read by
 * scanning down one column, and the header row is what makes the scan work.
 * Family — the one column that only earns its place on a desk (§4.2) — drops
 * out below 900px; what stays is the paint, its state, and the four things
 * you tap.
 *
 * A Server Component. The only client code in a row is the pencil, which owns
 * an open/closed boolean; the sort headers are links, the running-low and
 * remove controls are forms, and the find-a-shop link is a link.
 */
export function InventoryTable({
  items,
  params,
}: {
  items: InventoryItemRow[];
  params: InventoryParams;
}) {
  return (
    <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colPaint} scope="col">
              <SortableHeader label="Paint" column="paint" params={params} />
            </th>
            <th className={`${styles.colFamily} ${styles.deskColumn}`} scope="col">
              <SortableHeader label="Family" column="family" params={params} />
            </th>
            <th className={`${styles.colState} ${styles.deskColumn}`} scope="col">
              <SortableHeader label="State" column="state" params={params} />
            </th>
            <th className={styles.colActions} scope="col">
              <span className={styles.srOnly}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const name = item.paintName ?? item.paintCode;
            const size = item.paintSizeMl ? `${item.paintSizeMl} ml ` : "";
            const quantity = (item.quantity ?? 1) > 1 ? ` · ×${item.quantity}` : "";

            return (
              <tr key={item.id}>
                <td className={styles.colPaint}>
                  <div className={styles.paintCell}>
                    <span
                      className={styles.cellSwatch}
                      style={{ background: item.paintHex ?? "#c7c9d1" }}
                    />
                    <span className={styles.cellText}>
                      {/* The name is the way back to the ratio for this paint —
                          the question the shelf most often leads to. */}
                      <Link
                        className={styles.rowTitle}
                        href={`/thinner?code=${encodeURIComponent(item.paintCode)}`}
                      >
                        {name}
                      </Link>
                      <span className={styles.rowCode}>
                        {item.paintCode} · {size}
                        {formLabel(item.form)}
                        {quantity}
                      </span>
                    </span>
                  </div>
                </td>

                <td className={`${styles.colFamily} ${styles.deskColumn}`}>
                  <span className={styles.cellMuted}>{familyChipLabel(item.paintFamily)}</span>
                </td>

                <td className={`${styles.colState} ${styles.deskColumn}`}>
                  <span
                    className={`${styles.stateChip} ${
                      isRunningLow(item.state) ? styles.stateChipLow : ""
                    }`}
                  >
                    {stateLabel(item.state)}
                  </span>
                </td>

                <td className={styles.colActions}>
                  <div className={styles.actions}>
                    <LowToggle id={item.id} state={item.state} paintCode={item.paintCode} />

                    <EditItemTrigger
                      item={{
                        id: item.id,
                        paintCode: item.paintCode,
                        paintName: item.paintName,
                        paintHex: item.paintHex,
                        form: isInventoryForm(item.form) ? item.form : "bottle",
                        state: isInventoryState(item.state) ? item.state : null,
                        quantity: item.quantity ?? 1,
                        notes: item.notes ?? "",
                      }}
                    />

                    <RemoveButton id={item.id} paintCode={item.paintCode} />

                    {/* Deliberately a search, not a shop: the app carries no
                        pricing (§8) and the right shop differs per paint. */}
                    <a
                      className={styles.iconButton}
                      href={paintSearchUrl(item.paintCode, item.paintName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Search the web for ${item.paintCode}`}
                      aria-label={`Search the web for ${item.paintCode} ${name}`}
                    >
                      <ExternalLinkIcon size={16} />
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A column header that sorts on click — unsorted → ascending → descending →
 * unsorted, per `nextSortState`. Every state is a real URL (docs/PERFORMANCE.md
 * §6), so the router can prefetch the next sort while the header is merely
 * hovered.
 */
function SortableHeader({
  label,
  column,
  params,
}: {
  label: string;
  column: SortColumn;
  params: InventoryParams;
}) {
  const active = params.sort === column;
  const nextLabel = !active
    ? "ascending"
    : params.dir === "asc"
      ? "descending"
      : "unsorted";

  return (
    <Link
      href={inventoryHref(params, nextSortState(params, column))}
      scroll={false}
      className={styles.sortHeader}
      aria-label={`Sort by ${label}, ${nextLabel}`}
    >
      <span>{label}</span>
      {active ? (
        <ChevronDownIcon
          size={13}
          className={`${styles.sortIconActive} ${params.dir === "asc" ? styles.sortIconAsc : ""}`}
        />
      ) : (
        <SortIcon size={13} className={styles.sortIconIdle} />
      )}
    </Link>
  );
}
