import { ExternalLinkIcon, PlayIcon } from "@/components/icons";
import { KitCardBody } from "@/components/wishlist/KitCardBody";
import styles from "@/components/wishlist/Wishlist.module.css";
import type { KitRow } from "@/db/repositories/kits";
import { kitYoutubeSearchUrl } from "@/domain/kit";

/**
 * Identity + art + Scalemates link — docs/PLAN.md §6 Phase 4a. Reuses
 * `KitCardBody` wholesale rather than a bespoke hero layout: the shape
 * (art, brand, name, number, chips) is identical to a grid card's, just the
 * first thing on the page instead of one tile among many, and it comes with
 * the "change photo" affordance and the status chip for free. The
 * Scalemates and YouTube-search links ride in its `extra` slot — both are
 * "go elsewhere to learn more," so they sit together as one small row
 * rather than earning a section each.
 */
export function IdentityPanel({ kit }: { kit: KitRow }) {
  return (
    <div className={styles.card}>
      <KitCardBody
        imageUrl={kit.imageUrl}
        brand={kit.brand}
        name={kit.name}
        kitNumber={kit.kitNumber}
        scale={kit.scale}
        category={kit.category}
        status={kit.status}
        kitId={kit.id}
        priority
        extra={
          <div className={styles.cardChips}>
            {kit.scalematesUrl ? (
              <a className={styles.manualButton} href={kit.scalematesUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon size={12} /> Scalemates
              </a>
            ) : null}
            <a
              className={styles.manualButton}
              href={kitYoutubeSearchUrl(kit.brand, kit.kitNumber, kit.name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <PlayIcon size={12} /> Search YouTube
            </a>
          </div>
        }
      />
    </div>
  );
}
