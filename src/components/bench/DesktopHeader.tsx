import type { ReactNode } from "react";

import styles from "./DesktopHeader.module.css";

/**
 * The desktop screen title row — every bench screen uses this, none of them
 * their own copy. Three screens each had their own version of this markup
 * and the same CSS pasted in three times; Thinner's copy drifted to a 32px
 * bottom margin while the other two stayed at 26px, and none of them were
 * an actual heading element. One component instead of three copies is what
 * keeps that from happening again.
 *
 * A real `<h1>`: it's this screen's one heading, not a styled div. Phone's
 * equivalent (`PhoneHeader`) is a real `<h1>` too — whichever one the
 * viewport is actually showing is the page's only `<h1>`, and the other is
 * `display: none`, which removes it from the accessibility tree as well as
 * the page, so there's never two.
 *
 * `trailing` is optional — Paints puts its Add button here; Thinner and the
 * ComingSoon placeholders have nothing to put beside the title and just omit
 * it, which collapses cleanly since the header is a flex row either way.
 */
export function DesktopHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {trailing ? (
        <>
          <div className={styles.spacer} />
          {trailing}
        </>
      ) : null}
    </div>
  );
}
