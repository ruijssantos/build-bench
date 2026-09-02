import { getEquivalentsFor } from "@/catalogue/equivalents";

import styles from "./ThinnerBench.module.css";

/**
 * "Also sold as" — what this Tamiya code is called by the other brands, from
 * Phase 5's Cybermodeler chart (docs/PLAN.md §2.2).
 *
 * The useful direction at the bench is the one the Thinner Bench can't
 * otherwise answer: you're holding a Fujimi manual calling out Mr. Color, or
 * standing in a shop that stocks Vallejo, and you need to know what the code
 * in front of you maps to.
 *
 * Renders nothing when the chart has no rows — which is normal, not a
 * failure, and common on the TS/AS spray lines where coverage is thin. An
 * empty "no equivalents" card on most sprays would be worse than no card.
 *
 * A pure Server Component reading the compiled catalogue: no query, no client
 * JS, and it resolves during the same render as the rest of the bench.
 */
export function EquivalentsCard({ code }: { code: string }) {
  const brands = getEquivalentsFor(code);
  if (brands.length === 0) return null;

  return (
    <div className={styles.equivalentsCard}>
      <span className={styles.equivalentsTitle}>Also sold as</span>
      <div className={styles.equivalentsGrid}>
        {brands.map((brand) => (
          <div className={styles.equivalentsRow} key={brand.brandKey}>
            <span className={styles.equivalentsBrand}>{brand.label}</span>
            <span className={styles.equivalentsCodes}>
              {brand.codes.map((foreign) => (
                <span className={styles.equivalentsCode} key={foreign}>
                  {foreign}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
