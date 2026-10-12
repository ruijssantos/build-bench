import { CheckIcon, LowBottleIcon } from "@/components/icons";
import type { PaintOwnership } from "@/lib/thinner-bench";

import styles from "./StashChip.module.css";

/**
 * "Do I own this?", answered on the result card — §6, Phase 2.
 *
 * Both answers are drawn, not just the yes. Absence of a chip would be
 * indistinguishable from a chip that hasn't streamed in yet, and the whole
 * value of this thing is being sure while standing in a shop.
 *
 * `--ok` for owned is the token's own definition (§4.1: "in range / owned").
 * Not-owned is neutral rather than `--alert`: not owning a paint isn't
 * something to act on, it's just the answer. Owned-but-running-low is, so
 * that one does take `--alert`, with the Stash grid's bottle mark in place of
 * the check: the answer in a shop is "you have it, and buy another".
 */
export function StashChip({ ownership }: { ownership: PaintOwnership }) {
  if (!ownership.owned) {
    return <span className={styles.chipAbsent}>Not in your stash</span>;
  }

  if (ownership.low) {
    return (
      <span className={`${styles.chip} ${styles.chipLow}`}>
        <LowBottleIcon size={14} strokeWidth={2.4} className={styles.icon} aria-hidden="true" />
        <span>In your stash · running low</span>
        {ownership.detail ? <span className={styles.detail}> · {ownership.detail}</span> : null}
      </span>
    );
  }

  return (
    <span className={styles.chip}>
      <CheckIcon size={14} className={styles.icon} />
      <span>In your stash</span>
      {ownership.detail ? <span className={styles.detail}> · {ownership.detail}</span> : null}
    </span>
  );
}
