import { SignOutIcon } from "@/components/icons";

import styles from "./SignOutButton.module.css";

/**
 * Same /api/logout POST as Phase 0's home page used — moved into shared
 * chrome now that the root route redirects straight into the app.
 *
 * `className`/`labelClassName`/`iconSize` let a caller drop this into its
 * own layout using its own classes — `NavRail`'s full "Sign out" row and
 * `NavTabBar`'s icon-over-label tab are different enough shapes that
 * hard-coding a fixed set of variants here would just mean guessing every
 * future caller's needs in advance; a plain style passthrough doesn't.
 */
export function SignOutButton({
  className = styles.button,
  formClassName,
  labelClassName,
  iconSize = 16,
}: {
  /** Replaces the default button styling rather than adding to it — a
   * caller supplying its own class (`NavTabBar`'s `.item`) owns the whole
   * layout, so nothing here fights it over `height` or `gap`. */
  className?: string;
  /** The `<form>` is the actual element a flex row like `NavTabBar`'s needs
   * to size as one of its items — `className` alone reaches the `<button>`
   * a level too deep for that. */
  formClassName?: string;
  labelClassName?: string;
  iconSize?: number;
}) {
  return (
    <form method="POST" action="/api/logout" className={formClassName}>
      <button className={className} type="submit" aria-label="Sign out" title="Sign out">
        <SignOutIcon size={iconSize} />
        <span className={labelClassName}>Sign out</span>
      </button>
    </form>
  );
}
