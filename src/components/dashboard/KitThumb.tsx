import Image from "next/image";

import { KitsIcon } from "@/components/icons";

import styles from "./Dashboard.module.css";

/** The Blob suffix `next.config.ts`'s `images.remotePatterns` allowlists —
 * same check `KitArt` makes, and for the same reason. */
const OPTIMIZABLE_HOST_SUFFIX = ".public.blob.vercel-storage.com";

function isOptimizable(src: string): boolean {
  try {
    return new URL(src).hostname.endsWith(OPTIMIZABLE_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * A 48×36 box-art thumbnail for the Dashboard's rows.
 *
 * Deliberately a Server Component, unlike the card-sized `KitArt`, which is a
 * client island so it can swap a broken image for the fallback glyph. Here
 * the art is decoration on a summary row rather than the content of a card:
 * a saved kit's art is always re-hosted on our own Blob store by `saveBoxArt`,
 * so the failure `KitArt` guards against is a 404 on our own storage, and the
 * cost of guarding it would be shipping a client component per row to a
 * screen whose whole point is being cheap to open. A URL that isn't Blob-
 * hosted — which on a *saved* kit means someone edited one in by hand — gets
 * the glyph rather than an unoptimised remote fetch.
 */
export function KitThumb({ src, alt }: { src: string | null; alt: string }) {
  if (src && isOptimizable(src)) {
    return (
      <span className={styles.thumb}>
        <Image src={src} alt={alt} width={48} height={36} className={styles.thumbImg} loading="lazy" />
      </span>
    );
  }

  return (
    <span className={styles.thumb}>
      <KitsIcon size={17} strokeWidth={1.7} />
    </span>
  );
}
