import { SignOutIcon } from "@/components/icons";

import styles from "./SignOutButton.module.css";

/** Same /api/logout POST as Phase 0's home page used — moved into shared chrome
 * now that the root route redirects straight into the app. */
export function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <form method="POST" action="/api/logout">
      <button
        className={`${styles.button} ${iconOnly ? styles.iconOnly : ""}`}
        type="submit"
        aria-label="Sign out"
        title="Sign out"
      >
        <SignOutIcon size={iconOnly ? 15 : 16} />
        {iconOnly ? null : <span>Sign out</span>}
      </button>
    </form>
  );
}
