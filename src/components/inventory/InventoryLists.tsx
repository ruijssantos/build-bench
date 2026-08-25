import Link from "next/link";

import type { InventoryItemRow, SpraySessionRow } from "@/db/repositories/inventory";
import { formLabel, relativeDayLabel } from "@/domain/inventory";

import { LowToggle } from "./LowToggle";
import styles from "./Inventory.module.css";

function PaintRowText({
  code,
  name,
  sub,
}: {
  code: string;
  name: string;
  sub: string;
}) {
  return (
    <span className={styles.listText}>
      <Link className={styles.rowTitle} href={`/thinner?code=${encodeURIComponent(code)}`}>
        {name}
      </Link>
      <span className={styles.rowCode}>
        {code} · {sub}
      </span>
    </span>
  );
}

/**
 * Running low — the one place `--alert` appears on this screen, because it is
 * the one thing here you have to act on (§4.1).
 *
 * The section is absent when nothing is low, rather than showing an empty
 * card: a standing "nothing to do" panel is a panel you stop reading, and the
 * badge next to the heading is the whole point of it.
 *
 * The design reference draws a fill bar per row. There's no fill data — §6
 * gives no running-low threshold and the schema stores no level — so the row
 * carries the state and the toggle that clears it instead of a bar whose
 * length would be made up.
 */
export function RunningLow({ items }: { items: InventoryItemRow[] }) {
  if (items.length === 0) return null;

  return (
    <>
      <div className={styles.sectionHead}>
        <span className={styles.moduleTitle}>Running low</span>
        <span className={styles.sectionBadge}>{items.length}</span>
      </div>
      <div className={styles.listCard}>
        {items.map((item) => (
          <div className={styles.listRow} key={item.id}>
            <span
              className={styles.listSwatch}
              style={{ background: item.paintHex ?? "#c7c9d1" }}
            />
            <PaintRowText
              code={item.paintCode}
              name={item.paintName ?? item.paintCode}
              sub={`${item.paintSizeMl ? `${item.paintSizeMl} ml ` : ""}${formLabel(item.form)}`}
            />
            <span className={styles.listTrailing}>
              <LowToggle id={item.id} state={item.state} paintCode={item.paintCode} />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Recently sprayed, from `spray_session`.
 *
 * That table is the one that means what this section says, and it fills up in
 * Phase 8 when the Thinner Bench gets one-tap session logging (§6). Until then
 * this says so. Sorting `inventory_item` by `updated_at` would have filled the
 * card today at the cost of making "I marked this low" read as "I sprayed
 * this", which is a different claim about your afternoon.
 */
export function RecentlySprayed({ sessions }: { sessions: SpraySessionRow[] }) {
  const now = new Date();

  return (
    <>
      <div className={styles.sectionHead}>
        <span className={styles.moduleTitle}>Recently sprayed</span>
      </div>
      <div className={styles.listCard}>
        {sessions.length === 0 ? (
          <p className={styles.emptyNote}>
            Nothing logged yet — one-tap session logging from the Thinner Bench is Phase 8.
          </p>
        ) : (
          sessions.map((session) => (
            <div className={styles.listRow} key={session.id}>
              <span
                className={styles.listSwatch}
                style={{ background: session.paintHex ?? "#c7c9d1" }}
              />
              <PaintRowText
                code={session.paintCode}
                name={session.paintName ?? session.paintCode}
                sub="sprayed"
              />
              <span className={styles.listTrailing}>
                <span className={styles.rowNote}>
                  {session.sprayedAt ? relativeDayLabel(session.sprayedAt, now) : "—"}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
