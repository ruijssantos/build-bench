import { AdditiveCard } from "./AdditiveCard";
import { BenchNotes } from "./BenchNotes";
import { RatioHero } from "./RatioHero";
import { SpecGrid } from "./SpecGrid";
import { readBenchParams, type BenchSearchParams } from "./bench-params";
import styles from "./ThinnerBench.module.css";

import { resolveThinnerBench } from "@/lib/thinner-bench";

/**
 * The part of the bench that needs the database — the rig row and any saved
 * correction — and nothing else. A Server Component, so the spec tiles, the
 * bench notes and the additive card render on the server and never reach the
 * client bundle; only the ratio hero, which owns the drops slider, is an island.
 *
 * Everything above this in the tree is prerendered, so this streaming in is
 * the only thing a first paint waits for, and both of its reads are cached.
 */
export async function BenchContent({ searchParams }: { searchParams: Promise<BenchSearchParams> }) {
  const { code, line } = readBenchParams(await searchParams);
  const bundle = await resolveThinnerBench(code, line);

  if (!bundle.airbrush) {
    return (
      <div className={styles.notice}>
        No airbrush rig is seeded yet — run <code>npm run db:seed</code> to load the catalogue,
        ratio rules and rig facts.
      </div>
    );
  }

  if (!bundle.paint) {
    return (
      <div className={styles.emptyCard}>
        No match. Tamiya codes look like <b>X-7</b>, <b>XF-64</b>, <b>LP-2</b>, <b>TS-8</b> or{" "}
        <b>AS-12</b>.
      </div>
    );
  }

  if (bundle.isAdditive) {
    return (
      <div className={styles.heroArea}>
        <AdditiveCard
          paint={bundle.paint}
          notes={bundle.ratioRule?.notes ?? []}
          ownership={bundle.ownership}
        />
      </div>
    );
  }

  if (!bundle.effectiveRatio) {
    return <div className={styles.emptyCard}>No ratio rule is seeded for this family yet.</div>;
  }

  return (
    <>
      <div className={styles.heroArea}>
        <RatioHero
          paint={bundle.paint}
          ratio={bundle.effectiveRatio}
          cupCc={bundle.airbrush.cupCc ?? 7}
          ownership={bundle.ownership}
        />
      </div>
      <div className={styles.specsArea}>
        <SpecGrid
          psiText={bundle.effectiveRatio.psiText}
          distanceText={bundle.effectiveRatio.distanceText}
          coatsText={bundle.effectiveRatio.coatsText}
          thinnerType={bundle.ratioRule?.thinnerType ?? null}
        />
      </div>
      <div className={styles.notesArea}>
        <BenchNotes notes={bundle.effectiveRatio.notes} />
      </div>
    </>
  );
}
