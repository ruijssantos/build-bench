import Link from "next/link";

import { ReadyLine } from "@/components/kits/ReadyLine";
import { KitCardBody } from "@/components/wishlist/KitCardBody";
import cardStyles from "@/components/wishlist/Wishlist.module.css";
import { getStashReadiness } from "@/db/repositories/kit-paint-requirements";
import { listKitsByStatuses } from "@/db/repositories/kits";
import { formatIsoDate } from "@/domain/dates";

import styles from "./Dashboard.module.css";

/**
 * What's actually on the bench — every kit with `status: building`
 * (docs/PLAN.md §6 Phase 6). The screen's lead module, because it answers
 * the question you opened the app holding a part in your hand to ask.
 *
 * Renders the same `KitCardBody` + `ReadyLine` the Stash grid uses rather
 * than a dashboard-specific card: a kit looks like a kit wherever it appears,
 * and the readiness line is the one fact that makes this module more than a
 * shortcut.
 */
export async function OnTheBench() {
  const [kits, readiness] = await Promise.all([listKitsByStatuses(["building"]), getStashReadiness()]);

  if (kits.length === 0) {
    return (
      <div className={cardStyles.itemList}>
        <p className={styles.quiet}>
          Nothing on the bench. Move a kit to <Link href="/kits">Building</Link> when you start it.
        </p>
      </div>
    );
  }

  const byKit = new Map(readiness.map((row) => [row.kitId, row]));

  return (
    <div className={cardStyles.cardGrid}>
      {kits.map((kit, index) => {
        const started = formatIsoDate(kit.startedAt);
        return (
          <div className={cardStyles.card} key={kit.id}>
            <Link
              href={`/kits/${kit.id}`}
              className={cardStyles.cardStretchLink}
              aria-label={`Open ${kit.name ?? "kit"}`}
            />
            <KitCardBody
              imageUrl={kit.imageUrl}
              brand={kit.brand}
              name={kit.name}
              kitNumber={kit.kitNumber}
              scale={kit.scale}
              category={kit.category}
              status={kit.status}
              // The first card on the screen is its LCP candidate, same rule
              // as `SavedKitsGrid`'s own first card.
              priority={index === 0}
              extra={
                <>
                  <ReadyLine readiness={byKit.get(kit.id)} />
                  {started ? <span className={cardStyles.cardNotes}>Started {started}</span> : null}
                </>
              }
            />
          </div>
        );
      })}
    </div>
  );
}
