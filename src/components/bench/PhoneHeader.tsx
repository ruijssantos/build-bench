import type { ReactNode } from "react";

import { getActiveAirbrush } from "@/db/repositories/airbrush";

import { DryTipContent } from "./DryTipContent";
import { DryTipTrigger } from "./DryTipTrigger";
import styles from "./PhoneHeader.module.css";
import { shortRigLabel } from "./rig-label";
import { SignOutButton } from "./SignOutButton";

/**
 * The phone header. A Server Component: the title is usually this screen's LCP
 * element, so nothing about it should wait on a query or on hydration.
 *
 * `trailing` is a slot rather than a prop, so whatever sits opposite the title
 * can resolve on its own terms: the Thinner Bench streams the rig pill into it
 * behind a <Suspense> boundary, Paints puts its Add button there. Either is
 * shorter than the title block beside it and the row is `align-items:
 * flex-end`, so it lands without moving anything.
 */
export function PhoneHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className={styles.header}>
      <svg className={styles.sweep} width="230" height="230" viewBox="0 0 230 230" aria-hidden="true">
        <g transform="rotate(-21 115 115)">
          <rect x="58" y="-70" width="26" height="330" fill="var(--livery)" />
          <rect x="90" y="-70" width="10" height="330" fill="var(--livery)" />
        </g>
      </svg>

      <div className={styles.statusBarSpace} />

      <div className={styles.signOut}>
        <SignOutButton iconOnly />
      </div>

      <div className={styles.row}>
        <div>
          <div className={styles.eyebrow}>The Build Bench</div>
          <h1 className={styles.title}>{title}</h1>
        </div>
        {trailing}
      </div>
    </div>
  );
}

/** The rig pill on its own, so it can stream in behind its own boundary. */
export async function PhoneHeaderRigPill() {
  const airbrush = await getActiveAirbrush();
  if (!airbrush) return null;

  return (
    <DryTipTrigger
      title={`${airbrush.model ?? "Rig"} · Tips & Guide`}
      className={styles.rigPill}
      ariaLabel="Tips & guide for the current rig"
      trigger={
        <>
          <span className={styles.rigDot} />
          <span className={styles.rigLabel}>{shortRigLabel(airbrush.model ?? "Rig")}</span>
        </>
      }
    >
      <DryTipContent airbrush={airbrush} />
    </DryTipTrigger>
  );
}
