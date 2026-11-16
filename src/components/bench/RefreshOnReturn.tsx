"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Away for less than this, and nothing is re-fetched: a glance at another app isn't worth a request. */
const STALE_AFTER_MS = 30_000;

/**
 * Re-fetches the current route's server data when the app comes back to the
 * foreground after a while away.
 *
 * Mostly for the iOS home-screen web app. iOS keeps it suspended in memory,
 * so switching back to it shows the page exactly as it was left. Anything
 * changed meanwhile on another device stays invisible, and standalone mode
 * has no reload button or pull-to-refresh to fix that. In a browser tab it
 * does the same and costs the same: one request.
 *
 * `router.refresh()` keeps the current page on screen while it fetches and
 * merges the result in place, keeping scroll position, open dialogs and form
 * state (Next's `useRouter` docs). So coming back is never slower; at most,
 * changed values update a moment later.
 */
export function RefreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    let hiddenAt: number | null = null;

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= STALE_AFTER_MS) {
        router.refresh();
      }
      hiddenAt = null;
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [router]);

  return null;
}
