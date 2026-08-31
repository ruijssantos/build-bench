import { removeKit } from "@/app/(bench)/kits/actions";
import { ExternalLinkIcon, TrashIcon } from "@/components/icons";
import type { KitRow } from "@/db/repositories/kits";

import { EditKitTrigger } from "./EditKitTrigger";
import { KitCardBody } from "./KitCardBody";
import { MarkBoughtButton } from "./MarkBoughtButton";
import styles from "./Wishlist.module.css";

/** One saved kit — box art, identity, and the things you do with it: mark it
 * bought, edit its properties, open its link, or remove it. A Server
 * Component; the only client code in it is the bought tick's pending state
 * and the Edit dialog, each its own small island. */
export function SavedKitCard({ kit, priority }: { kit: KitRow; priority?: boolean }) {
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
        notes={kit.notes}
        priority={priority}
        kit={kit}
      />
      <div className={styles.savedCardActions}>
        <MarkBoughtButton id={kit.id} />
        <div className={styles.savedSpacer} />
        <EditKitTrigger kit={kit} />
        {/* Generic now, not Scalemates-specific: a hand-entered kit can put
            any URL here — a retailer page, a forum thread, whatever's
            useful — and it renders the same link icon a resolved kit's
            Scalemates page does. */}
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
