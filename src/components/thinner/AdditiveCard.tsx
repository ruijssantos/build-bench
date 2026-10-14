import type { PaintOwnership, ResolvedPaintIdentity } from "@/lib/thinner-bench";
import ui from "@/styles/ui.module.css";

import styles from "./AdditiveCard.module.css";
import benchNotes from "./BenchNotes.module.css";
import hero from "./RatioHero.module.css";
import { StashChip } from "./StashChip";

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
    <div className={hero.card}>
      <div className={hero.liveryStrip}>
        <div className={hero.liveryBar1} />
        <div className={hero.liveryGap} />
        <div className={hero.liveryBar2} />
      </div>
      <div className={hero.body}>
        <div className={hero.identityRow}>
          <div className={hero.swatch} style={{ background: paint.hex }} />
          <div>
            <div className={hero.code}>{paint.code}</div>
            <div className={styles.name}>{paint.name}</div>
            <div className={styles.tag}>Additive · not sprayed alone</div>
          </div>
        </div>

        {paint.known ? (
          <div className={hero.stashRow}>
            <StashChip ownership={ownership} />
          </div>
        ) : null}

        <div className={hero.divider} />

        <div className={`${ui.moduleTitle} ${benchNotes.title}`}>How to use it</div>
        <div className={benchNotes.list}>
          {notes.map((note) => (
            <div className={benchNotes.item} key={note}>
              <span className={benchNotes.dot} />
              <span className={benchNotes.text}>{note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
