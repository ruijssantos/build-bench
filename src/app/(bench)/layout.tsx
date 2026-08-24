import { Suspense } from "react";

import { QuietError } from "@/components/bench/BenchError";
import { NavRail } from "@/components/nav/NavRail";
import { NavRailRig } from "@/components/nav/NavRailRig";
import { NavTabBar } from "@/components/nav/NavTabBar";

import styles from "./layout.module.css";

/**
 * No `force-dynamic`, and nothing awaited at this level.
 *
 * With Cache Components the whole shell — rail, brand, nav links, tab bar and
 * the page frame under it — prerenders and is served from the CDN. The only
 * database read in this layout is the rig row, and it sits behind its own
 * boundary inside the rail so it can't hold the shell up. That also keeps
 * `next build` from needing DATABASE_URL, which CI doesn't have.
 */
export default function BenchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <NavRail
        rig={
          <QuietError>
            <Suspense fallback={null}>
              <NavRailRig />
            </Suspense>
          </QuietError>
        }
      />
      <div className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </div>
      <NavTabBar />
    </div>
  );
}
