import { ExternalLinkIcon, TrashIcon } from "@/components/icons";
import { removeKitAction } from "@/app/(bench)/wishlist/actions";
import type { KitRow } from "@/db/repositories/kits";

import { KitCardBody } from "./KitCardBody";
import { MarkBoughtButton } from "./MarkBoughtButton";
import styles from "./Wishlist.module.css";

/** One saved kit — box art, identity, and the three things you do with it:
 * mark it bought, open its Scalemates page, or remove it. A Server
 * Component; the only client code in it is the bought tick's pending state. */
export function SavedKitCard({ kit }: { kit: KitRow }) {
  const title = kit.name ?? "kit";

  return (
    <div className={styles.card}>
      <KitCardBody
        imageUrl={kit.imageUrl}
        brand={kit.brand}
        name={kit.name}
        kitNumber={kit.kitNumber}
        scale={kit.scale}
        category={kit.category}
      />
      <div className={styles.savedCardActions}>
        <MarkBoughtButton id={kit.id} />
        <div className={styles.savedSpacer} />
        {kit.scalematesUrl ? (
          <a
            className={styles.iconButton}
            href={kit.scalematesUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on Scalemates"
            aria-label={`Open ${title} on Scalemates`}
          >
            <ExternalLinkIcon size={15} />
          </a>
        ) : null}
        <form action={removeKitAction}>
          <input type="hidden" name="id" value={kit.id} />
          <button
            type="submit"
            className={styles.iconButton}
            title={`Remove ${title} from the wishlist`}
            aria-label={`Remove ${title} from the wishlist`}
          >
            <TrashIcon size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
