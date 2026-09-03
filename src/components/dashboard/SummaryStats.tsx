import Link from "next/link";

import { countKitsByStatus } from "@/db/repositories/kits";
import { listInventory } from "@/db/repositories/inventory";
import { listWishlistItems } from "@/db/repositories/wishlist-items";
import { KIT_STATUSES } from "@/domain/kit";
import cardStyles from "@/components/wishlist/Wishlist.module.css";

import styles from "./Dashboard.module.css";

/**
 * The four counts across the top — docs/PLAN.md §6 Phase 6.
 *
 * Every tile is a link, because a count is only ever the start of a
 * question: 4 running low is worth knowing, but the useful next move is the
 * shelf filtered to those four.
 *
 * `listInventory` and `listWishlistItems` are the same cached reads
 * `/inventory` and `/wishlist` already make, so this reuses their cache
 * entries rather than adding a count query per screen — the shelf's own
 * comment makes the same point about "running low" needing no query of its
 * own, and that holds one screen further out.
 */
export async function SummaryStats() {
  const [kitCounts, shelf, otherItems] = await Promise.all([
    countKitsByStatus([...KIT_STATUSES]),
    listInventory(),
    listWishlistItems(),
  ]);

  const lowCount = shelf.filter((row) => row.state === "low").length;
  const stashCount = (kitCounts.stash ?? 0) + (kitCounts.building ?? 0) + (kitCounts.built ?? 0);
  const buildingCount = kitCounts.building ?? 0;
  const wishlistCount = kitCounts.wishlist ?? 0;
  const wantedCount = otherItems.filter((item) => item.status === "wanted").length;

  return (
    <div className={styles.stats}>
      <Stat href="/inventory" label="On the shelf" value={shelf.length} unit="paints" />
      <Stat
        href="/inventory?low=1"
        label="Running low"
        value={lowCount}
        unit="to replace"
        alert={lowCount > 0}
      />
      <Stat
        href="/kits"
        label="In the stash"
        value={stashCount}
        unit={buildingCount > 0 ? `kits · ${buildingCount} building` : "kits"}
      />
      <Stat
        href="/wishlist"
        label="Wishlist"
        value={wishlistCount}
        unit={wantedCount > 0 ? `kits · ${wantedCount} items` : "kits"}
      />
    </div>
  );
}

function Stat({
  href,
  label,
  value,
  unit,
  alert = false,
}: {
  href: string;
  label: string;
  value: number;
  unit: string;
  /** Only "Running low" sets this — a count that is itself the thing to act
   * on gets `--alert`, per §4.1's rule that colour carries meaning. Zero is
   * not an alert: nothing to replace is good news, in the default ink. */
  alert?: boolean;
}) {
  return (
    <Link href={href} className={styles.stat}>
      <span className={cardStyles.moduleTitle}>{label}</span>
      <span className={styles.statRow}>
        <span className={`${styles.statValue} ${alert ? styles.statValueAlert : ""}`}>{value}</span>
        <span className={styles.statUnit}>{unit}</span>
      </span>
    </Link>
  );
}
