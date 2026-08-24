import { DryTipContent } from "@/components/bench/DryTipContent";
import { DryTipTrigger } from "@/components/bench/DryTipTrigger";
import { getActiveAirbrush } from "@/db/repositories/airbrush";

import styles from "./NavRail.module.css";

/**
 * The rail's Current Rig block. A Server Component so the rig row is fetched
 * here rather than at the top of the layout — the rest of the rail, and the
 * whole page under it, is prerendered and painted while this streams in.
 *
 * It costs nothing visually: the block sits below a `flex: 1` spacer, so it
 * fills space the spacer was already holding open. Nothing moves when it lands.
 */
export async function NavRailRig() {
  const airbrush = await getActiveAirbrush();
  if (!airbrush) return null;

  return (
    <div className={styles.rig}>
      <div className={styles.rigLabel}>Current rig</div>
      <div className={styles.rigModel}>{airbrush.model}</div>
      <div className={styles.rigChips}>
        {airbrush.nozzleMm != null ? (
          <span className={styles.rigChip}>{airbrush.nozzleMm} mm</span>
        ) : null}
        {airbrush.cupCc != null ? <span className={styles.rigChip}>{airbrush.cupCc} cc</span> : null}
      </div>
      <DryTipTrigger
        title={`${airbrush.model ?? "Rig"} · Tips & Guide`}
        className={styles.rigLink}
        trigger="Tips & Guide"
      >
        <DryTipContent airbrush={airbrush} />
      </DryTipTrigger>
    </div>
  );
}
