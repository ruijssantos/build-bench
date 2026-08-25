import { Suspense } from "react";

import { BenchError } from "@/components/bench/BenchError";
import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader, PhoneHeaderRigPill } from "@/components/bench/PhoneHeader";
import { SearchIcon } from "@/components/icons";
import { BenchContent } from "@/components/thinner/BenchContent";
import { LineToggle, SearchArea } from "@/components/thinner/BenchHeadings";
import { BenchSkeleton } from "@/components/thinner/BenchSkeleton";
import searchStyles from "@/components/thinner/SearchBox.module.css";
import styles from "@/components/thinner/ThinnerBench.module.css";

export const metadata = { title: "Thinner Bench" };

/**
 * Not async, and nothing awaited here: the frame below — header, title, grid,
 * tab bar — is the same for every paint code, so it prerenders once and a CDN
 * serves it. Each boundary underneath resolves at its own cost:
 *
 *   SearchArea / LineToggle  URL + compiled catalogue, no I/O — first flush
 *   BenchContent             any correction + what's on the shelf — streams
 *
 * The rig pill needs no boundary at all: the rig is compiled in, so it
 * prerenders with the header. See docs/PERFORMANCE.md for why the boundaries
 * sit where they do.
 */
export default function ThinnerPage(props: PageProps<"/thinner">) {
  return (
    <>
      <PhoneHeader title="Thinner Bench" trailing={<PhoneHeaderRigPill />} />

      <DesktopHeader title="Thinner Bench" />

      <div className={styles.phoneSearchBlock}>
        <Suspense fallback={<SearchBoxFallback scope="phone" />}>
          <SearchArea scope="phone" searchParams={props.searchParams} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <LineToggle searchParams={props.searchParams} />
      </Suspense>

      <div className={styles.scrollArea}>
        <div className={styles.grid}>
          {/* Outside the content boundary on purpose: search is the one thing
              that must work the instant the screen paints, and it needs
              nothing from the database to do so. */}
          <div className={styles.searchArea}>
            <Suspense fallback={<SearchBoxFallback scope="desktop" />}>
              <SearchArea scope="desktop" searchParams={props.searchParams} />
            </Suspense>
          </div>

          <BenchError label="The bench">
            <Suspense fallback={<BenchSkeleton />}>
              <BenchContent searchParams={props.searchParams} />
            </Suspense>
          </BenchError>
        </div>
      </div>
    </>
  );
}

/** The search box's own chrome, minus the resolved label — identical box, so
 * the prerendered shell reserves exactly the right space. */
function SearchBoxFallback({ scope }: { scope: "phone" | "desktop" }) {
  return (
    <div className={scope === "phone" ? searchStyles.onlyPhone : searchStyles.onlyDesktop}>
      <div className={searchStyles.wrap}>
        <div className={`${searchStyles.box} ${scope === "desktop" ? searchStyles.boxDesktop : ""}`}>
          <SearchIcon size={scope === "desktop" ? 18 : 19} className={searchStyles.icon} />
          <span className={searchStyles.input} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
