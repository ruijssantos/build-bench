import type { ReactNode } from "react";

import styles from "./PhoneHeader.module.css";

/**
 * The phone header. A Server Component: the title is usually this screen's LCP
 * element, so nothing about it should wait on a query or on hydration.
 *
 * `trailing` is a slot rather than a prop, so whatever sits opposite the title
 * can resolve on its own terms: Paints puts its Add button there, the kit
 * page its Edit/Remove pair. Either is shorter than the title block
 * beside it and the row is `align-items: flex-end`.
 *
 * `stackTrailing` swaps that side-by-side row for `trailing` on its own line
 * below the title instead — for a title this component doesn't control the
 * length of. Every other caller's title is a short, fixed screen name
 * ("Paints", "Wishlist") that never wraps next to a pill or a button; the
 * kit detail page's title is the kit's own name, which can run to a full
 * sentence and, side by side with Edit/Remove, wrapped across three lines
 * with the buttons stranded halfway down them. Defaults to the side-by-side
 * layout so every other screen is unaffected.
 *
 * Sign out lives in `NavTabBar` as its sixth tab, not up here — one control,
 * reachable at a thumb's swipe on every screen, rather than a corner icon
 * duplicated per header.
 */
export function PhoneHeader({
  title,
  trailing,
  stackTrailing = false,
}: {
  title: string;
  trailing?: ReactNode;
  stackTrailing?: boolean;
}) {
  return (
    <div className={styles.header}>
      <svg className={styles.sweep} width="230" height="230" viewBox="0 0 230 230" aria-hidden="true">
        <g transform="rotate(-21 115 115)">
          <rect x="58" y="-70" width="26" height="330" fill="var(--livery)" />
          <rect x="90" y="-70" width="10" height="330" fill="var(--livery)" />
        </g>
      </svg>

      <div className={styles.statusBarSpace} />

      <div className={`${styles.row} ${stackTrailing ? styles.rowStacked : ""}`}>
        <div>
          <div className={styles.eyebrow}>The Build Bench</div>
          <h1 className={styles.title}>{title}</h1>
        </div>
        {trailing}
      </div>
    </div>
  );
}
