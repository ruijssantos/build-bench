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
   * visible link. The nav rail links to five routes from every screen, so this
   * is the difference between five prefetches per page and five cache hits.
   */
  partialPrefetching: true,

  cacheLife: {
    /**
     * Per-paint bench data the user can correct from the UI (`ratio_override`).
     * Short-lived on the server, on top of the tag invalidation that is what
     * actually makes a saved correction show up immediately.
     *
     * `expire` deliberately sits under five minutes: that keeps the value out
     * of the *prerender* so `next build` never needs DATABASE_URL — CI has
     * none — while still caching it at runtime. `stale` is the client's reuse
     * window: how long the router will re-show an already-rendered screen
     * without going back to the server.
     */
    bench: { stale: 30, revalidate: 60, expire: 240 },

    /**
     * The paint shelf (`inventory_item`). Written from the UI — a tap on
     * "Running low", an Add, an edit — so it lives on tag invalidation, with
     * the same sub-five-minute `expire` keeping it out of the prerender.
     */
    inventory: { stale: 30, revalidate: 60, expire: 240 },

    /**
     * The wishlist — saved `kit` rows and `wishlist_item` rows. Same shape as
     * `inventory`: written from the UI (search-and-save, manual entry, ticking
     * bought), so it lives on tag invalidation with the same sub-five-minute
     * `expire`.
     */
    wishlist: { stale: 30, revalidate: 60, expire: 240 },
  },

  /**
   * A saved kit's box art is re-hosted on our own Vercel Blob store at save
   * time (`saveBoxArt`, docs/PLAN.md §2.4) — never linked to arbitrary hosts
   * — so it's the one image source in the app safe to run through Next's
   * optimizer. `**` matches the store's subdomain, which is per-deployment.
   * A search candidate's art, still on whoever's host the search turned up,
   * is deliberately excluded: `next/image` would refuse an unlisted host at
   * request time, so `KitArt` renders that case as a plain `<img>` instead
   * (docs/PERFORMANCE.md, Wishlist section).
   */
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }],
  },

  // Deliberately NOT set: `experimental.inlineCss`. Measured on this app, it
  // makes every document 15 kB larger gzipped rather than smaller — React
  // serialises the same CSS into the RSC payload as well as the <style> tag,
  // so inlining sends it twice. Two hashed stylesheets totalling 5.7 kB
  // gzipped, cached across every navigation, win. Re-measure before changing.
};

export default nextConfig;
