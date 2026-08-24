import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Cache Components — Partial Prerendering by default. Every route ships a
   * static shell (chrome, headings, search box, skeletons) that a CDN can
   * serve with no server invocation; only the parts that genuinely need the
   * database stream in behind their <Suspense> boundaries.
   *
   * See docs/PERFORMANCE.md for the rules this enables.
   */
  cacheComponents: true,

  /**
   * One reusable App Shell prefetched per route rather than one prefetch per
   * visible link. The nav rail links to six routes from every screen, so this
   * is the difference between six prefetches per page and six cache hits.
   */
  partialPrefetching: true,

  cacheLife: {
    /**
     * Rows that are read on every screen but written by hand, roughly never
     * (the `airbrush` rig row). `expire` deliberately sits under five minutes:
     * that keeps the value out of the *prerender* so `next build` never needs
     * DATABASE_URL — CI has none — while still caching it at runtime.
     *
     * `stale` is the client's reuse window: how long the router will re-show
     * an already-rendered screen without going back to the server. Three
     * minutes suits data that changes when you buy a new airbrush.
     */
    rig: { stale: 180, revalidate: 120, expire: 240 },

    /**
     * Per-paint bench data the user can correct from the UI (`ratio_override`).
     * Short-lived on the server, on top of the tag invalidation that is what
     * actually makes a saved correction show up immediately — so the client
     * can afford the same three-minute reuse window as the rig row.
     */
    bench: { stale: 180, revalidate: 60, expire: 240 },
  },

  // Deliberately NOT set: `experimental.inlineCss`. Measured on this app, it
  // makes every document 15 kB larger gzipped rather than smaller — React
  // serialises the same CSS into the RSC payload as well as the <style> tag,
  // so inlining sends it twice. Two hashed stylesheets totalling 5.7 kB
  // gzipped, cached across every navigation, win. Re-measure before changing.
};

export default nextConfig;
