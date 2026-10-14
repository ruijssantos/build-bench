"use client";

import { useSyncExternalStore } from "react";

import styles from "./Dashboard.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const noSubscribe = () => () => {};

/**
 * "46 days · since 29 Aug" on the dashboard's bench card.
 *
 * Client only, and blank on the server: the dashboard shell is prerendered,
 * so a count computed there would be frozen at build time, and "today" is the
 * viewer's own calendar day anyway. `useSyncExternalStore` with a `null`
 * server snapshot fills it in right after hydration without a mismatch. The
 * line keeps its height while blank, so nothing below it moves.
 */
export function DaysOnBench({ startedAt }: { startedAt: string }) {
  const today = useSyncExternalStore(noSubscribe, todayIso, () => null);

  const [sy, sm, sd] = startedAt.split("-").map(Number);
  const since = `${sd} ${MONTHS[sm - 1]}`;

  let days: number | null = null;
  let sameYear = true;
  if (today) {
    const [ty, tm, td] = today.split("-").map(Number);
    days = Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86_400_000));
    sameYear = ty === sy;
  }

  return (
    <div className={styles.benchDays}>
      <span className={styles.benchDaysValue}>{days ?? " "}</span>
      <span className={styles.benchDaysUnit}>
        {days == null ? " " : `${days === 1 ? "day" : "days"} · since ${since}${sameYear ? "" : ` ${sy}`}`}
      </span>
    </div>
  );
}
