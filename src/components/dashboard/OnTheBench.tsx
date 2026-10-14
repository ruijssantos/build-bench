import Link from "next/link";

import { StatusBar } from "@/components/kits/StatusBar";
import { KitCardBody } from "@/components/kits/KitCardBody";
import cardStyles from "@/components/kits/Kits.module.css";
import { listKitsByStatuses } from "@/db/repositories/kits";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

import styles from "./Dashboard.module.css";
import { DaysOnBench } from "./DaysOnBench";

/**
 * What's actually on the bench — every kit with `status: building`
 * (docs/PLAN.md §6 Phase 6). The screen's lead module, because it answers
 * the question you opened the app holding a part in your hand to ask.
 *
 * Renders the same `KitCardBody` the Stash grid uses rather than a
 * dashboard-specific card: a kit looks like a kit wherever it appears. Its
 * `aside` column carries the status instead of a chip — days on the bench
 * over the same `StatusBar` the kit page uses — which is also what fills the
 * width this hero card used to leave empty beside its text. No
 * readiness line here, unlike the Stash card: a kit only goes on the bench
 * once its paints are in, so "Ready to build" told the owner nothing. A paint
 * still missing shows up on the shop run beside it.
 *
 * Laid out as a full-width hero rather than a grid — see `.benchCard` in
 * `Dashboard.module.css` for why. Two kits stack as two rows; the owner
 * builds one at a time, occasionally two, so there is no third case to plan
 * for and a grid would strand exactly the width this module should be using.
 */
export async function OnTheBench() {
  const kits = await listKitsByStatuses(["building"]);

  if (kits.length === 0) {
    return (
      <div className={page.itemList}>
        <p className={styles.quiet}>
          Nothing on the bench. Move a kit to <Link href="/kits">Building</Link> when you start it.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.benchList}>
      {kits.map((kit, index) => (
          <div className={`${cardStyles.card} ${styles.benchCard}`} key={kit.id}>
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
              // The first card on the screen is its LCP candidate, same rule
              // as `SavedKitsGrid`'s own first card.
              priority={index === 0}
              aside={
                <>
                  <span className={ui.moduleTitle}>On the bench</span>
                  {kit.startedAt ? <DaysOnBench startedAt={kit.startedAt} /> : null}
                  {/* Every kit here is `building` — that's the query. */}
                  <StatusBar status="building" />
                </>
              }
            />
          </div>
      ))}
    </div>
  );
}
