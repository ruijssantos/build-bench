import styles from "@/components/kits/Kits.module.css";
import type { KitRow } from "@/db/repositories/kits";
import { formatIsoDate } from "@/domain/dates";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

import { EditPurchaseTrigger } from "./EditPurchaseTrigger";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={styles.detailRow}>
      <span className={ui.fieldLabel}>{label}</span>
      <span className={`${styles.detailValue} ${value ? "" : styles.detailValueEmpty}`}>{value ?? "Not set"}</span>
    </div>
  );
}

/**
 * Purchase details and started/completed dates — docs/PLAN.md §6 Phase 4a:
 * `kit.purchasedFrom`/`purchasedAt` already existed in the database and in
 * no UI; this is what finally plumbs them through. Started/completed are
 * stamped automatically on the status stepper's forward transitions
 * (`updateKitStatus`) and editable here after the fact.
 */
export function DetailsPanel({ kit }: { kit: KitRow }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <div className={page.subHead}>
          <span className={ui.moduleTitle}>Purchase &amp; dates</span>
          <EditPurchaseTrigger kit={kit} />
        </div>
        <Row label="Purchased from" value={kit.purchasedFrom} />
        <Row label="Purchased" value={formatIsoDate(kit.purchasedAt)} />
        <Row label="Started" value={formatIsoDate(kit.startedAt)} />
        <Row label="Completed" value={formatIsoDate(kit.completedAt)} />
      </div>
    </div>
  );
}
