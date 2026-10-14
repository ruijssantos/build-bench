import { StatusBar } from "@/components/kits/StatusBar";
import styles from "@/components/kits/Kits.module.css";
import type { KitStatus } from "@/domain/kit";
import ui from "@/styles/ui.module.css";

import { StatusActions } from "./StatusActions";

/** The status ladder as `StatusBar` (shared with the dashboard's bench card)
 * over the one-hop actions. This is the only place status changes in place,
 * so it's where the bar's fill and drain animations are actually seen.
 *
 * Four steps while the kit is still on the wishlist, three once it's bought:
 * buying is one-directional (§3.3), so on a stashed kit a Wishlist step would
 * only ever be a finished box nobody can return to. */
export function StatusPanel({ id, status }: { id: number; status: KitStatus }) {
  return (
    <div className={styles.card}>
      <div className={`${styles.cardBody} ${styles.statusBody}`}>
        <span className={ui.moduleTitle}>Status</span>
        <StatusBar status={status} size="large" />
        <StatusActions id={id} status={status} />
      </div>
    </div>
  );
}
