import benchNotes from "./BenchNotes.module.css";
import styles from "./BenchSkeleton.module.css";
import hero from "./RatioHero.module.css";
import specs from "./SpecGrid.module.css";
import bench from "./ThinnerBench.module.css";

/**
 * What the static shell paints while the rig row and any saved correction are
 * still in flight.
 *
 * It is built from the real components' own class names, so its height comes
 * from the same CSS the finished card does — the point of a skeleton here is
 * to hold the exact box, not to look busy.
 */
function Line({ width, className }: { width: number; className: string }) {
  // A digit, not a space: at the ratio numbers' size the two have noticeably
  // different em boxes, and this placeholder's whole job is to be the exact
  // height of what replaces it.
  return (
    <span className={`${className} ${styles.block}`} style={{ width }}>
      0
    </span>
  );
}

export function BenchSkeleton() {
  return (
    <>
      <div className={bench.heroArea} aria-hidden="true">
        <div className={hero.card}>
          <div className={hero.liveryStrip}>
            <div className={hero.liveryBar1} />
            <div className={hero.liveryGap} />
            <div className={hero.liveryBar2} />
          </div>
          <div className={hero.body}>
            <div className={hero.identityRow}>
              <div className={`${hero.swatch} ${styles.swatch}`} />
              <div className={hero.identityPhone}>
                <Line className={hero.code} width={54} />
                <Line className={hero.familyLine} width={120} />
              </div>
              <div className={hero.identityDesktop}>
                <Line className={hero.code} width={54} />
                <Line className={hero.name} width={190} />
              </div>
            </div>

            <div className={hero.ratioSection}>
              <div className={hero.ratioHeader}>
                <Line className={hero.ratioLabel} width={190} />
              </div>
              {/* Same three children as the real card: the ratio numbers are
                  the tallest thing on it, so they have to measure identically
                  or everything below them moves when the content lands. */}
              <div className={hero.ratioNumbers}>
                <Line className={hero.num} width={40} />
                <span className={hero.colon}>:</span>
                <Line className={hero.num} width={54} />
              </div>
            </div>

            <div className={hero.windowSection}>
              <div className={hero.track}>
                <div className={styles.bar} />
              </div>
              <div className={hero.windowLabels}>
                <Line className={hero.windowLabel} width={62} />
                <Line className={hero.windowMid} width={104} />
                <Line className={hero.windowLabel} width={62} />
              </div>
            </div>

            <div className={hero.divider} />

            <div>
              <div className={hero.sliderRow}>
                {/* A real range input, disabled — a plain div doesn't have a
                    range input's box metrics. */}
                <input className={hero.slider} type="range" disabled readOnly tabIndex={-1} />
                <Line className={hero.sliderLabel} width={92} />
              </div>
              <div className={hero.cupHeader}>
                <Line className={hero.cupHeaderLeft} width={150} />
                <Line className={hero.cupHeaderRight} width={110} />
              </div>
              <div className={hero.cupBar} />
              <Line className={hero.cupCaption} width={160} />
            </div>
          </div>
        </div>
      </div>

      {/* One stack, matching `BenchContent`'s own `.sideArea`. No placeholder
          for the "Also sold as" card: whether it renders at all depends on
          the code, so reserving its box would leave a hole on every paint the
          chart doesn't cover — which is most of the spray lines. */}
      <div className={bench.sideArea} aria-hidden="true">
        <div className={specs.grid}>
          {["pressure", "distance", "coats", "thinner"].map((key) => (
            <div className={specs.tile} key={key}>
              <Line className={specs.label} width={72} />
              <Line className={specs.value} width={104} />
            </div>
          ))}
        </div>

        <div className={benchNotes.card}>
          <Line className={benchNotes.title} width={110} />
          <div className={benchNotes.list}>
            {/* Two lines each: bench notes are full sentences, and a
                one-line placeholder under-reserves every one of them. */}
            {[0, 1, 2].map((i) => (
              <div className={benchNotes.item} key={i}>
                <span className={benchNotes.dot} />
                <span className={benchNotes.text}>
                  <Line className={styles.line} width={264} />
                  <Line className={styles.line} width={i === 2 ? 150 : 208} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
