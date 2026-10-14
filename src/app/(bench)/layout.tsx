import { NavRail } from "@/components/nav/NavRail";
import { NavTabBar } from "@/components/nav/NavTabBar";

import styles from "./layout.module.css";

/**
 * The ceiling for every Server Action on these screens, and so for whatever
 * they hand to `after()`. Set here, once, for the one that needs it: adding a
 * kit — from the wishlist, the stash, or a kit's own page — starts an upgrades
 * search that runs one to three minutes after the action has answered
 * (`searchUpgradesAfterResponse` in `kits/actions.ts`). §1.2's 300s, the same
 * as the paid route handlers.
 */
export const maxDuration = 300;

/**
 * No `force-dynamic`, and nothing awaited at this level.
 *
 * With Cache Components the whole shell — rail, brand, nav links, tab bar and the page frame under it — prerenders and is served from the CDN.
 * This layout reads no database at all, which is also what keeps `next build`
 * from needing DATABASE_URL, which CI doesn't have.
 */
export default function BenchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <NavRail />
      <main className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </main>
      <NavTabBar />
    </div>
  );
}
