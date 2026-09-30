import { PaintsIcon } from "@/components/icons";
import styles from "@/components/wishlist/Wishlist.module.css";
import type { ReadinessCounts } from "@/domain/kit-paints";

/**
 * "Own 14 of 17 · 3 to buy" — the Stash card's line and the detail page's
 * Paints panel summary both render this from a `ReadinessCounts`
 * (`PaintsIcon`, the same glyph the nav rail's Paints tab uses, marking the
 * line as being about paints without spending a text label on saying so).
 *
 * `wanted` is a wishlist kit's reading of the same counts: it isn't yours
 * yet, so the gap is paint you'd need rather than paint to buy, and a full
 * shelf means you already have every paint rather than that it's ready to
 * build.
 *
 * An LP covered by an owned X/XF twin counts as owned here (it's nothing to
 * buy, and nothing stopping the build), with the count of them shown so
 * "Own 17 of 17" never hides that three of those are stand-ins.
 */
export function ReadyLine({ readiness, wanted = false }: { readiness: ReadinessCounts | undefined; wanted?: boolean }) {
  if (!readiness) {
    return (
      <div className={styles.readyNone}>
        <PaintsIcon size={13} className={styles.readyIcon} />
        No paint list yet
      </div>
    );
  }

  const have = readiness.ownedCount + readiness.equivalentCount;
  const resolved = have + readiness.missingCount;
  const viaEquivalent =
    readiness.equivalentCount > 0 ? ` (${readiness.equivalentCount} via X/XF)` : "";

  return (
    <div className={styles.readyLine}>
      <PaintsIcon size={13} className={styles.readyIcon} />
      {readiness.missingCount > 0 ? (
        <>
          <span className={styles.readyCount}>
            Own {have} of {resolved}
            {viaEquivalent}
          </span>
          <span className={styles.readyBuy}>
            · {readiness.missingCount} {wanted ? "you'd need" : "to buy"}
          </span>
        </>
      ) : (
        <span className={styles.readyReady}>
          Own {resolved} of {resolved}
          {viaEquivalent} · {wanted ? "You have them all" : "Ready to build"}
        </span>
      )}
      {readiness.unresolvedCount > 0 ? (
        <span className={styles.readyUnresolved}>+{readiness.unresolvedCount} unresolved</span>
      ) : null}
    </div>
  );
}
