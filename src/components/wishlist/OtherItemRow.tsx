import { removeWishlistItemAction, toggleWishlistItemBought } from "@/app/(bench)/wishlist/actions";
import { CheckIcon, ExternalLinkIcon, TrashIcon } from "@/components/icons";
import type { WishlistItemRow } from "@/db/repositories/wishlist-items";

import styles from "./Wishlist.module.css";

/** One "Other items" row — a tick, the title (with its optional link), and
 * remove. A `<form action={…}>` around a server-rendered button for both
 * controls, same shape as inventory's `LowToggle`/`RemoveButton`: no client
 * JavaScript, works before hydration. */
export function OtherItemRow({ item }: { item: WishlistItemRow }) {
  const bought = item.status === "bought";

  return (
    <div className={styles.itemRow}>
      <form action={toggleWishlistItemBought}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="status" value={item.status} />
        <button
          type="submit"
          className={`${styles.itemTick} ${bought ? styles.itemTickChecked : ""}`}
          aria-pressed={bought}
          title={bought ? `Mark ${item.title} wanted again` : `Mark ${item.title} bought`}
          aria-label={bought ? `Mark ${item.title} wanted again` : `Mark ${item.title} bought`}
        >
          <CheckIcon size={13} />
        </button>
      </form>

      <div className={styles.itemBody}>
        <div className={styles.itemTitleRow}>
          <span className={`${styles.itemTitle} ${bought ? styles.itemTitleBought : ""}`}>{item.title}</span>
          {item.url ? (
            <a
              className={styles.itemLink}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open link"
              aria-label={`Open link for ${item.title}`}
            >
              <ExternalLinkIcon size={13} />
            </a>
          ) : null}
        </div>
        {item.notes ? <span className={styles.itemNotes}>{item.notes}</span> : null}
      </div>

      <form action={removeWishlistItemAction}>
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          className={styles.iconButton}
          title={`Remove ${item.title}`}
          aria-label={`Remove ${item.title}`}
        >
          <TrashIcon size={15} />
        </button>
      </form>
    </div>
  );
}
