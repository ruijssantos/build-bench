import { Suspense } from "react";
import { preconnect } from "react-dom";

import { BenchError } from "@/components/bench/BenchError";
import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import {
  BenchSkeleton,
  RowsSkeleton,
  StatsSkeleton,
} from "@/components/dashboard/DashboardSkeletons";
import { OnTheBench } from "@/components/dashboard/OnTheBench";
import { ReadyToBuild } from "@/components/dashboard/ReadyToBuild";
import { ShopRun } from "@/components/dashboard/ShopRun";
import { SummaryStats } from "@/components/dashboard/SummaryStats";
import { WishlistSnapshot } from "@/components/dashboard/WishlistSnapshot";
import styles from "@/components/dashboard/Dashboard.module.css";
import cardStyles from "@/components/wishlist/Wishlist.module.css";
import { blobStoreOrigin } from "@/lib/box-art";

export const metadata = { title: "Dashboard" };

/**
 * The Dashboard — docs/PLAN.md §6 Phase 6, and the screen the app opens on.
 *
 * Not async, nothing awaited at the top level: the header, the column frames
 * and every section title are the same on every visit, so they prerender and
 * a CDN serves them. Each of the five modules sits behind its own <Suspense>
 * inside its own <BenchError>, which matters more here than anywhere else in
 * the app — this screen reads from four different parts of the database, and
 * a slow or failed shop-run query has no business holding up (or blanking)
 * what's on the bench.
 *
 * The bench spans the full width and the other three modules sit as equal
 * columns beneath it. That ordering is the layout doing what the data says:
 * the owner builds one kit at a time, so the bench holds exactly one card
 * and deserves the width, while the three supporting modules are all lists
 * that read fine narrow.
 *
 * Deliberately read-only. Every module is a link into the screen that owns
 * the thing — there are no actions here, so there is nothing to keep in sync
 * with the screens that do own them.
 */
export default function DashboardPage() {
  const blobOrigin = blobStoreOrigin();
  if (blobOrigin) preconnect(blobOrigin);

  return (
    <>
      <PhoneHeader title="Dashboard" />
      <DesktopHeader title="Dashboard" />

      <div className={cardStyles.scrollArea}>
        <div className={cardStyles.grid}>
          <BenchError label="The summary">
            <Suspense fallback={<StatsSkeleton />}>
              <SummaryStats />
            </Suspense>
          </BenchError>

          <section className={cardStyles.section}>
            <div className={cardStyles.sectionHead}>
              <h2 className={cardStyles.sectionTitle}>On the bench</h2>
            </div>
            <BenchError label="On the bench">
              <Suspense fallback={<BenchSkeleton />}>
                <OnTheBench />
              </Suspense>
            </BenchError>
          </section>

          <div className={styles.columns}>
            <section className={cardStyles.section}>
              <div className={cardStyles.sectionHead}>
                <h2 className={cardStyles.sectionTitle}>What you could start</h2>
              </div>
              <BenchError label="Ready to build">
                <Suspense fallback={<RowsSkeleton />}>
                  <ReadyToBuild />
                </Suspense>
              </BenchError>
            </section>

            <section className={cardStyles.section}>
              <div className={cardStyles.sectionHead}>
                <h2 className={cardStyles.sectionTitle}>Next shop run</h2>
              </div>
              <BenchError label="The shop list">
                <Suspense fallback={<RowsSkeleton />}>
                  <ShopRun />
                </Suspense>
              </BenchError>
            </section>

            <section className={cardStyles.section}>
              <div className={cardStyles.sectionHead}>
                <h2 className={cardStyles.sectionTitle}>Wishlist</h2>
              </div>
              <BenchError label="The wishlist">
                <Suspense fallback={<RowsSkeleton />}>
                  <WishlistSnapshot />
                </Suspense>
              </BenchError>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
