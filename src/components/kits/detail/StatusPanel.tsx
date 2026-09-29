import { CheckIcon } from "@/components/icons";
import styles from "@/components/wishlist/Wishlist.module.css";
import { KIT_STATUSES, STASH_STATUSES, statusLabel, type KitStatus } from "@/domain/kit";

import { StatusActions } from "./StatusActions";

/** The status ladder — accent marks the current step (§4.1: accent is
 * selection), ok marks a done one, everything after stays neutral. Colour
 * carries meaning here the way the Stash card's own status chip does.
 *
 * Four steps while the kit is still on the wishlist, three once it's bought:
 * buying is one-directional (§3.3), so on a stashed kit a Wishlist step would
 * only ever be a finished box nobody can return to. */
export function StatusPanel({ id, status }: { id: number; status: KitStatus }) {
  const steps: readonly KitStatus[] = status === "wishlist" ? KIT_STATUSES : STASH_STATUSES;
  const index = steps.indexOf(status);

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <span className={styles.moduleTitle}>Status</span>
        <div className={styles.stepper}>
          {steps.map((s, i) => {
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
