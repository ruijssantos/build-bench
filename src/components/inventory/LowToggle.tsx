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
 *
 * `paintCode` and `state` ride along as hidden fields so the action never
 * has to re-fetch this row just to relearn what it already rendered — see
 * the comment on `toggleRunningLow` for why that used to be the whole reason
 * this felt slow.
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
      <input type="hidden" name="paintCode" value={paintCode} />
      <input type="hidden" name="state" value={state ?? ""} />
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
