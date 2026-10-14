"use client";

import { useState } from "react";

import { KIT_STATUSES, STASH_STATUSES, statusLabel, type KitStatus } from "@/domain/kit";

import styles from "./StatusBar.module.css";

/**
 * The status ladder as a segmented bar — Stash → Building → Built, with a
 * Wishlist step in front only while the kit is still on the wishlist (the
 * same rule the old stepper had). One component for the dashboard's "On the
 * bench" card and the kit page's Status panel, so the two can't drift
 * (docs/PLAN.md §4.1 Motion).
 *
 * Finished steps are `--ok`, the current one `--accent`, future ones an empty
 * track; Built is the end of the ladder, so it reads finished, not current.
 *
 * Motion: every filled segment fills from the left once on first paint. After
 * that a status change animates through CSS transitions on the same segment
 * elements: forward fills the next segment from the left, back drains it from
 * the right, and reaching Built runs one chequered sweep. Only the kit page
 * ever changes status in place; the dashboard just gets the first-paint fill.
 *
 * Client only for that direction memory: which way to drain or fill has to be
 * known in the same render that changes the classes, so it's derived during
 * render from the previous status (React's "adjusting state while rendering"
 * pattern) rather than in an effect, which would land a frame late.
 */
export function StatusBar({ status, size = "base" }: { status: KitStatus; size?: "base" | "large" }) {
  const steps: readonly KitStatus[] = status === "wishlist" ? KIT_STATUSES : STASH_STATUSES;
  const index = steps.indexOf(status);

  const [seen, setSeen] = useState(status);
  const [backwards, setBackwards] = useState(false);
  const [sweep, setSweep] = useState(0);
  if (seen !== status) {
    setSeen(status);
    setBackwards(KIT_STATUSES.indexOf(status) < KIT_STATUSES.indexOf(seen));
    if (status === "built") setSweep((n) => n + 1);
  }

  return (
    <div className={`${styles.bar} ${size === "large" ? styles.large : ""} ${backwards ? styles.backwards : ""}`}>
      <ol className={styles.steps} aria-label="Status" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
        {steps.map((step, i) => {
          const done = i < index || (i === index && step === "built");
          const current = i === index && !done;
          return (
            <li
              key={step}
              className={`${styles.step} ${done ? styles.done : ""} ${current ? styles.current : ""}`}
              aria-current={i === index ? "step" : undefined}
            >
              <span className={styles.segment} aria-hidden="true" />
              <span className={styles.label}>{statusLabel(step)}</span>
            </li>
          );
        })}
      </ol>
      {sweep > 0 ? <span key={sweep} className={styles.sweep} aria-hidden="true" /> : null}
    </div>
  );
}
