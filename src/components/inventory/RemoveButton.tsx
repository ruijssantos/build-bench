import { removeInventoryItemAction } from "@/app/(bench)/inventory/actions";
import { TrashIcon } from "@/components/icons";

import styles from "./Inventory.module.css";

/**
 * The one-click remove in the table row — no confirmation, no modal.
 *
 * `EditItemDialog` still has its own two-tap Remove for the deliberate path;
 * this is the fast one, for when you're sure. A `<form action={…}>` around a
 * server-rendered button, same shape as `LowToggle`: no client JavaScript,
 * works before hydration, the response is the row disappearing.
 */
export function RemoveButton({ id, paintCode }: { id: number; paintCode: string }) {
  return (
    <form action={removeInventoryItemAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={styles.iconButton}
        title={`Remove ${paintCode} from the shelf`}
        aria-label={`Remove ${paintCode} from the shelf`}
      >
        <TrashIcon size={16} />
      </button>
    </form>
  );
}
