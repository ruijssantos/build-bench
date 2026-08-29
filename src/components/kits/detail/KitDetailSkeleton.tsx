import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import styles from "@/components/wishlist/Wishlist.module.css";

/**
 * The outer <Suspense> fallback, shaped from the same `.card`/`.cardBody`
 * classnames the real panels use (docs/PERFORMANCE.md §11 point 3) — not
 * pixel-exact (the real page's height depends on how many manuals and paint
 * rows a kit has, which isn't knowable before the query resolves), but close
 * enough that the two-column desktop / stacked-phone shape doesn't jump.
 *
 * It renders the *real* `PhoneHeader`/`DesktopHeader` rather than omitting
 * them: the title comes from the kit, so the header lives inside the boundary,
 * and a fallback without one let ~110px of header (sweep graphic, eyebrow,
 * title) drop in above already-painted cards when the query resolved — a CLS
 * hit on the one route this phase added, against §11's own rule. Using the
 * same components with a placeholder title reserves exactly the right height
 * by construction, rather than a guess at it.
 */
export function KitDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <PhoneHeader title="Kit" />
      <DesktopHeader title="Kit" />
      <div className={styles.scrollArea}>
        <div className={styles.detailGrid}>
          <div className={styles.railCol}>
            <div className={styles.card}>
              <div className={`${styles.cardArt} ${styles.skeletonSwatch}`} />
              <div className={styles.cardBody}>
                <span className={`${styles.cardName} ${styles.skeletonLine}`} style={{ width: "70%" }}>
                  Kit name
                </span>
                <span className={`${styles.cardNumber} ${styles.skeletonLine}`} style={{ width: 60 }}>
                  No.
                </span>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 56 }}>
                  Status
                </span>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 120 }}>
                  Purchase &amp; dates
                </span>
              </div>
            </div>
          </div>
          <div className={styles.mainCol}>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 90 }}>
                  Manuals
                </span>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <span className={`${styles.moduleTitle} ${styles.skeletonLine}`} style={{ width: 70 }}>
                  Paints
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
