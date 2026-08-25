import { toggleRunningLow } from "@/app/(bench)/inventory/actions";
import { LowBottleIcon } from "@/components/icons";
import { isRunningLow } from "@/domain/inventory";

import styles from "./Inventory.module.css";

/**
 * "Running low", in one tap.
 *
 * A plain `<form action={…}>` around a server-rendered button, not an onClick
 * handler: the whole shelf grid therefore ships no client JavaScript, the tap
 * works before hydration has finished (which on a phone at the bench is most
 * of the taps that matter), and what comes back is the re-rendered row.
 */
export function LowToggle({
  id,
  state,
  paintCode,
}: {
  id: number;
  state: string | null;
  paintCode: string;
}) {
  const low = isRunningLow(state);

  return (
    <form action={toggleRunningLow}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={`${styles.lowButton} ${low ? styles.lowButtonActive : ""}`}
        aria-pressed={low}
        title={low ? `Mark ${paintCode} restocked` : `Mark ${paintCode} running low`}
        aria-label={low ? `Mark ${paintCode} restocked` : `Mark ${paintCode} running low`}
      >
        <LowBottleIcon size={15} />
        <span className={styles.lowButtonLabel}>Low</span>
      </button>
    </form>
  );
}
