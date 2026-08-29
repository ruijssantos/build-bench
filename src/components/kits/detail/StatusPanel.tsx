import { CheckIcon } from "@/components/icons";
import styles from "@/components/wishlist/Wishlist.module.css";
import { STASH_STATUSES, statusLabel, type StashStatus } from "@/domain/kit";

import { StatusActions } from "./StatusActions";

/** The three-step ladder — accent marks the current step (§4.1: accent is
 * selection), ok marks a done one, everything after stays neutral. Colour
 * carries meaning here the way the Stash card's own status chip does. */
export function StatusPanel({ id, status }: { id: number; status: StashStatus }) {
  const index = STASH_STATUSES.indexOf(status);

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <span className={styles.moduleTitle}>Status</span>
        <div className={styles.stepper}>
          {STASH_STATUSES.map((s, i) => {
            const done = i < index;
            const current = i === index;
            return (
              <div
                key={s}
                className={`${styles.step} ${done ? styles.stepDone : ""} ${current ? styles.stepCurrent : ""}`}
              >
                <span className={styles.stepDot}>{done ? <CheckIcon size={11} /> : i + 1}</span>
                <span className={styles.stepLabel}>{statusLabel(s)}</span>
              </div>
            );
          })}
        </div>
        <StatusActions id={id} status={status} />
      </div>
    </div>
  );
}
