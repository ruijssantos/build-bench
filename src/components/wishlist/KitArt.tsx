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
 */
export function KitArt({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={styles.cardArt}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs, not a domain next/image can allowlist
        <img
          src={src ?? undefined}
          alt={alt}
          className={styles.cardArtImg}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <KitsIcon size={26} className={styles.cardArtFallback} />
      )}
    </div>
  );
}
