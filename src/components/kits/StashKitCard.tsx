import Link from "next/link";

import { removeKit } from "@/app/(bench)/kits/actions";
import { ExternalLinkIcon, TrashIcon } from "@/components/icons";
import { EditKitTrigger } from "@/components/wishlist/EditKitTrigger";
import { KitCardBody } from "@/components/wishlist/KitCardBody";
import styles from "@/components/wishlist/Wishlist.module.css";
import type { KitReadiness } from "@/db/repositories/kit-paint-requirements";
import type { KitRow } from "@/db/repositories/kits";
import { isStashStatus } from "@/domain/kit";

import { AdvanceStatusButton } from "./AdvanceStatusButton";
import { ReadyLine } from "./ReadyLine";

/**
 * One stashed kit — forked from the Wishlist's `SavedKitCard` (docs/PLAN.md
 * §6 Phase 4a): the shape is close, but this card is also a link to its own
 * detail page and carries the readiness line and status chip neither
 * predecessor needed, which is enough real difference to earn its own file
 * rather than another prop on an already-generalised component.
 *
 * The whole card is a link to `/kits/[id]` — a stretched overlay
 * (`.cardStretchLink`) rather than wrapping the art/body in an `<a>`, which
 * would nest the art-edit button (and the actions row's own buttons, links
 * and form) inside it: invalid HTML, and a real hydration risk. Every actual
 * control raises its own `z-index` above the overlay instead.
 */
export function StashKitCard({
  kit,
  priority,
  readiness,
}: {
  kit: KitRow;
  priority?: boolean;
  readiness: KitReadiness | undefined;
}) {
  const status = isStashStatus(kit.status) ? kit.status : "stash";
  const title = kit.name ?? "kit";

  return (
    <div className={styles.card}>
      <Link href={`/kits/${kit.id}`} className={styles.cardStretchLink} aria-label={`Open ${title}`} />
      <KitCardBody
        imageUrl={kit.imageUrl}
        brand={kit.brand}
        name={kit.name}
        kitNumber={kit.kitNumber}
        scale={kit.scale}
        category={kit.category}
        status={kit.status}
        priority={priority}
        kit={kit}
        extra={<ReadyLine readiness={readiness} />}
      />
      <div className={styles.savedCardActions}>
        <AdvanceStatusButton id={kit.id} status={status} />
        <div className={styles.savedSpacer} />
        <EditKitTrigger kit={kit} />
        {kit.scalematesUrl ? (
          <a
            className={styles.iconButton}
            href={kit.scalematesUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open link"
            aria-label={`Open link for ${title}`}
          >
            <ExternalLinkIcon size={15} />
          </a>
        ) : null}
        <form action={removeKit}>
          <input type="hidden" name="id" value={kit.id} />
          <button type="submit" className={styles.iconButton} title={`Remove ${title}`} aria-label={`Remove ${title}`}>
            <TrashIcon size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
