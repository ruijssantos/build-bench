import { RIG } from "@/catalogue/rig";
import { DryTipContent } from "@/components/bench/DryTipContent";
import { DryTipTrigger } from "@/components/bench/DryTipTrigger";

import styles from "./NavRail.module.css";

/**
 * The rail's Current Rig block. Synchronous: the rig is compiled into the
 * build (`@/catalogue/rig`), so this block prerenders into the rail's static
 * shell along with everything else in it — no query, no boundary, nothing to
 * stream.
 */
export function NavRailRig() {
  return (
    <div className={styles.rig}>
      <div className={styles.rigLabel}>Current rig</div>
      <div className={styles.rigModel}>{RIG.model}</div>
      <div className={styles.rigChips}>
        <span className={styles.rigChip}>{RIG.nozzleMm} mm</span>
        <span className={styles.rigChip}>{RIG.cupCc} cc</span>
      </div>
      <DryTipTrigger
        title={`${RIG.model} · Tips & Guide`}
        className={styles.rigLink}
        trigger="Tips & Guide"
      >
        <DryTipContent />
      </DryTipTrigger>
    </div>
  );
}
