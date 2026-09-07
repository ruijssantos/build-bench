import Link from "next/link";

import inventoryStyles from "@/components/inventory/Inventory.module.css";
import styles from "@/components/wishlist/Wishlist.module.css";
import { listOwnedPaintCodes } from "@/db/repositories/inventory";
import { listKitPaintRequirements } from "@/db/repositories/kit-paint-requirements";
import { paintSearchUrl } from "@/domain/inventory";
import { bucketPaintRequirements } from "@/domain/kit-paints";

/**
 * Paints vs. the shelf — docs/PLAN.md §6 Phase 4a. This kit's own extracted
 * requirements, cross-referenced against the shelf for exactly the codes
 * this kit needs (one targeted query, not the Stash grid's whole-table
 * aggregate — see `db/repositories/kit-paint-requirements.ts` for that one).
 */
export async function PaintsPanel({ kitId }: { kitId: number }) {
  const requirements = await listKitPaintRequirements(kitId);

  if (requirements.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <span className={styles.moduleTitle}>Paints</span>
          <div className={inventoryStyles.emptyCard}>
            Upload a manual and extract its paint list to see what this kit needs.
          </div>
        </div>
      </div>
    );
  }

  const codes = [...new Set(requirements.map((r) => r.paintCode).filter((c): c is string => Boolean(c)))];
  const owned = await listOwnedPaintCodes(codes);
  const buckets = bucketPaintRequirements(requirements, owned);

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.subHead}>
          <span className={styles.moduleTitle}>Paints</span>
        </div>

        <div className={styles.paintBucket}>
          <div className={styles.bucketHead}>
            <span className={`${styles.bucketDot} ${styles.bucketDotOwned}`} />
            <span className={styles.moduleTitle}>Owned ({buckets.owned.length})</span>
          </div>
          {buckets.owned.length > 0 ? (
            <div className={styles.cardChips}>
              {buckets.owned.map((p) => (
                <Link
                  key={p.code}
                  className={styles.ownedChip}
                  href={`/thinner?code=${encodeURIComponent(p.code)}`}
                  title={p.name ?? undefined}
                  aria-label={`${p.code}${p.name ? `, ${p.name}` : ""} — open on the Thinner bench`}
                >
                  <span className={styles.paintDot} style={{ background: p.hex }} />
                  {p.code}
                </Link>
              ))}
            </div>
          ) : (
            <span className={styles.photoHint}>None yet.</span>
          )}
        </div>

        <div className={styles.paintBucket}>
          <div className={styles.bucketHead}>
            <span className={`${styles.bucketDot} ${styles.bucketDotMissing}`} />
            <span className={styles.moduleTitle}>Missing ({buckets.missing.length})</span>
          </div>
          {buckets.missing.length > 0 ? (
            <div className={styles.cardChips}>
              {buckets.missing.map((p) => (
                <a
                  key={p.code}
                  className={styles.missingChip}
                  href={paintSearchUrl(p.code, p.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={p.name}
                  aria-label={`${p.code}, ${p.name} — find somewhere selling it`}
                >
                  <span className={styles.paintDot} style={{ background: p.hex }} />
                  {p.code}
                </a>
              ))}
            </div>
          ) : (
            <span className={styles.photoHint}>Nothing missing.</span>
          )}
        </div>

        {buckets.unresolved.length > 0 ? (
          <div className={styles.paintBucket}>
            <div className={styles.bucketHead}>
              <span className={`${styles.bucketDot} ${styles.bucketDotUnresolved}`} />
              <span className={styles.moduleTitle}>Unresolved ({buckets.unresolved.length})</span>
            </div>
            {buckets.unresolved.map((u) => (
              <div key={u.rawLabel} className={styles.unresolvedRow}>
                <span className={styles.unresolvedLabel}>{u.rawLabel}</span>
                <span className={styles.unresolvedTag}>Needs cross-brand lookup</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
