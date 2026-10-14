import { removeWishlistItemAction, toggleWishlistItemBought } from "@/app/(bench)/wishlist/actions";
import { CheckIcon, ExternalLinkIcon, TrashIcon } from "@/components/icons";
import type { WishlistItemRow } from "@/db/repositories/wishlist-items";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

import { EditWishlistItemTrigger } from "./EditWishlistItemTrigger";

/** One "Other items" row — a tick, the title (with its optional link), edit,
 * and remove. The tick and remove are `<form action={…}>`s around a
 * server-rendered button, same shape as inventory's `LowToggle`/
 * `RemoveButton`: no client JavaScript, works before hydration. Edit is the
 * one client island in the row, its dialog fetched only on click. */
export function OtherItemRow({ item }: { item: WishlistItemRow }) {
  const bought = item.status === "bought";

  return (
    <div className={page.itemRow}>
      <form action={toggleWishlistItemBought}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="status" value={item.status} />
        <button
          type="submit"
          className={`${page.itemTick} ${bought ? page.itemTickChecked : ""}`}
          aria-pressed={bought}
          title={bought ? `Mark ${item.title} wanted again` : `Mark ${item.title} bought`}
          aria-label={bought ? `Mark ${item.title} wanted again` : `Mark ${item.title} bought`}
        >
          <CheckIcon size={13} />
        </button>
      </form>

      <div className={page.itemBody}>
        <div className={page.itemTitleRow}>
          <span className={`${page.itemTitle} ${bought ? page.itemTitleBought : ""}`}>{item.title}</span>
          {item.url ? (
            <a
              className={page.itemLink}
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
        {item.notes ? <span className={page.itemNotes}>{item.notes}</span> : null}
      </div>

      <EditWishlistItemTrigger item={item} />

      <form action={removeWishlistItemAction}>
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          className={`${ui.iconBtn} ${ui.iconBtnAlert}`}
          title={`Remove ${item.title}`}
          aria-label={`Remove ${item.title}`}
        >
          <TrashIcon size={16} />
        </button>
      </form>
    </div>
  );
}
