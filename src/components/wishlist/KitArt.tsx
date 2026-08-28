"use client";

import Image from "next/image";
import { useState } from "react";

import { KitsIcon } from "@/components/icons";

import styles from "./Wishlist.module.css";

/** The suffix `next.config.ts`'s `images.remotePatterns` allowlists — a
 * saved kit's art, always re-hosted on our own Blob store by `saveBoxArt`. A
 * search candidate's art is still on whoever's host the search turned up, so
 * it fails this check and falls back to a plain `<img>` below; `next/image`
 * would 400 on an unlisted host, and there's no benefit optimising a URL
 * that's about to be thrown away the moment the candidate isn't saved. */
const OPTIMIZABLE_HOST_SUFFIX = ".public.blob.vercel-storage.com";

function isOptimizable(src: string): boolean {
  try {
    return new URL(src).hostname.endsWith(OPTIMIZABLE_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * Box art, with a fallback glyph — its own tiny client island rather than
 * making the whole card client-side (docs/PERFORMANCE.md §4).
 *
 * `priority` marks the LCP candidate — the first saved kit in `SavedKitsGrid`
 * — so its bytes start downloading from the initial HTML instead of waiting
 * to be discovered mid-scroll. Every other card keeps the old lazy behaviour.
 */
export function KitArt({
  src,
  alt,
  priority = false,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  if (showImage && src && isOptimizable(src)) {
    return (
      <div className={styles.cardArt}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 900px) 320px, 100vw"
          className={styles.cardArtImg}
          preload={priority}
          loading={priority ? undefined : "lazy"}
          onError={() => setFailedSrc(src)}
        />
      </div>
    );
  }

  return (
    <div className={styles.cardArt}>
      {showImage && src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs, not a domain next/image can allowlist
        <img
          src={src}
          alt={alt}
          className={styles.cardArtImg}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          // A search candidate's art is still on whoever's host the kit page
          // pointed at, and a good number of them refuse requests that carry
          // a foreign Referer. Sending none reads as a direct visit and gets
          // the image; a saved kit's art is on our own Blob and doesn't care
          // either way.
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <KitsIcon size={26} className={styles.cardArtFallback} />
      )}
    </div>
  );
}
