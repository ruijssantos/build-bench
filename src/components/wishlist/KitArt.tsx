"use client";

import { useState } from "react";

import { KitsIcon } from "@/components/icons";

import styles from "./Wishlist.module.css";

/**
 * Box art, with a fallback glyph — its own tiny client island rather than
 * making the whole card client-side (docs/PERFORMANCE.md §4).
 *
 * A search candidate's `src` is a live URL Claude's web search turned up —
 * it can 404 or simply be slow, and there's no server-side way to know
 * before rendering. `onError` swaps to the same fallback a manually-entered
 * or art-less saved kit shows, rather than a browser's broken-image glyph.
 *
 * `failed` is keyed to the URL it was set for, not left as a bare boolean:
 * React can reuse this instance for a different card when a new search
 * renders into the same grid position, and a sticky `true` would then hide a
 * perfectly good image behind the fallback. Comparing against the `src` that
 * failed resets it for free, with no effect.
 */
export function KitArt({ src, alt }: { src: string | null; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <div className={styles.cardArt}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs, not a domain next/image can allowlist
        <img
          src={src ?? undefined}
          alt={alt}
          className={styles.cardArtImg}
          loading="lazy"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <KitsIcon size={26} className={styles.cardArtFallback} />
      )}
    </div>
  );
}
