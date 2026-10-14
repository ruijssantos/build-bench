import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { ChevronLeftIcon } from "@/components/icons";
import styles from "@/components/kits/Kits.module.css";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

/**
 * The outer <Suspense> fallback, shaped from the same `.card`/`.cardBody`
 * classnames the real panels use (docs/PERFORMANCE.md §11 point 3) — not
 * pixel-exact (the real page's height depends on how many manuals and paint
 * rows a kit has, which isn't knowable before the query resolves), but close
 * enough that the two-column desktop / stacked-phone shape doesn't jump.
 *
 * It renders the *real* `PhoneHeader`/`DesktopHeader` rather than omitting
 * them: the title comes from the kit, so the header lives inside the boundary,
 * and a fallback without one let ~110px of header (eyebrow, title) drop in
 * above already-painted cards when the query resolved — a CLS
 * hit on the one route this phase added, against §11's own rule. Using the
 * same components with a placeholder title reserves exactly the right height
 * by construction, rather than a guess at it. The breadcrumb is inside the
 * boundary for the same reason (its target depends on the kit's status), so
 * it gets the same treatment: the real `.crumb` shape, not a link.
 */
export function KitDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={styles.crumbBar}>
        <span className={`${ui.moduleTitle} ${styles.crumb}`}>
          <ChevronLeftIcon size={14} /> Kits
        </span>
      </div>
      <PhoneHeader
        title="Kit"
        eyebrow={
          <span className={`${ui.moduleTitle} ${styles.crumb}`}>
            <ChevronLeftIcon size={14} /> Kits
          </span>
        }
      />
      <DesktopHeader title="Kit" />
      <div className={page.scrollArea}>
        <div className={styles.detailGrid}>
          <div className={styles.railCol}>
            <div className={styles.card}>
              <div className={`${styles.cardArt} ${page.skeletonSwatch}`} />
              <div className={styles.cardBody}>
                <span className={`${styles.cardName} ${page.skeletonLine}`} style={{ width: "70%" }} />
                <span className={`${styles.cardNumber} ${page.skeletonLine}`} style={{ width: 60 }} />
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <span className={`${ui.moduleTitle} ${page.skeletonLine}`} style={{ width: 56 }} />
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <span className={`${ui.moduleTitle} ${page.skeletonLine}`} style={{ width: 120 }} />
              </div>
            </div>
          </div>
          <div className={styles.mainCol}>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <span className={`${ui.moduleTitle} ${page.skeletonLine}`} style={{ width: 90 }} />
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <span className={`${ui.moduleTitle} ${page.skeletonLine}`} style={{ width: 70 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
