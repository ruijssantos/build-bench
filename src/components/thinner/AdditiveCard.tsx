import type { PaintOwnership, ResolvedPaintIdentity } from "@/lib/thinner-bench";

import { StashChip } from "./StashChip";
import styles from "./AdditiveCard.module.css";

/** An additive is a result card too, so it answers the same shop question the
 * ratio hero does. */
export function AdditiveCard({
  paint,
  notes,
  ownership,
}: {
  paint: ResolvedPaintIdentity;
  notes: string[];
  ownership: PaintOwnership;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.liveryStrip}>
        <div className={styles.liveryBar1} />
        <div className={styles.liveryGap} />
        <div className={styles.liveryBar2} />
      </div>
      <div className={styles.body}>
        <div className={styles.identityRow}>
          <div className={styles.swatch} style={{ background: paint.hex }} />
          <div>
            <div className={styles.code}>{paint.code}</div>
            <div className={styles.name}>{paint.name}</div>
            <div className={styles.tag}>Additive · not sprayed alone</div>
          </div>
        </div>

        {paint.known ? (
          <div className={styles.stashRow}>
            <StashChip ownership={ownership} />
          </div>
        ) : null}

        <div className={styles.divider} />

        <div className={styles.title}>How to use it</div>
        <div className={styles.list}>
          {notes.map((note) => (
            <div className={styles.item} key={note}>
              <span className={styles.dot} />
              <span className={styles.text}>{note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
