import Link from "next/link";

import { ExternalLinkIcon } from "@/components/icons";
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
import styles from "./Inventory.module.css";

/**
 * Every paint you own, as a table.
 *
 * A real `<table>` rather than a stack of divs: it is a table, it is read by
 * scanning down one column, and the header row is what makes the scan work.
 * The two columns that only earn their place on a desk — family and location
 * (§4.2) — drop out below 900px; what stays is the paint, its state, and the
 * three things you tap.
 *
 * A Server Component. The only client code in a row is the pencil, which owns
 * an open/closed boolean; the running-low toggle is a form, and the find-a-shop
 * link is a link.
 */
export function InventoryTable({ items }: { items: InventoryItemRow[] }) {
  return (
    <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colPaint} scope="col">
              Paint
            </th>
            <th className={`${styles.colFamily} ${styles.deskColumn}`} scope="col">
              Family
            </th>
            <th className={`${styles.colLocation} ${styles.deskColumn}`} scope="col">
              Location
            </th>
            <th className={`${styles.colState} ${styles.deskColumn}`} scope="col">
              State
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

                <td className={`${styles.colLocation} ${styles.deskColumn}`}>
                  <span
                    className={`${styles.cellMuted} ${item.location ? "" : styles.cellFaint}`}
                  >
                    {item.location ?? "—"}
                  </span>
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

                    <EditItemTrigger
                      item={{
                        id: item.id,
                        paintCode: item.paintCode,
                        paintName: item.paintName,
                        paintHex: item.paintHex,
                        form: isInventoryForm(item.form) ? item.form : "bottle",
                        state: isInventoryState(item.state) ? item.state : null,
                        quantity: item.quantity ?? 1,
                        location: item.location ?? "",
                        notes: item.notes ?? "",
                      }}
                    />
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
