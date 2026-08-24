"use client";

import { useState } from "react";

import type { AirbrushRow } from "@/db/repositories/airbrush";

import { DryTipContent } from "./DryTipContent";
import { Modal } from "./Modal";
import styles from "./PhoneHeader.module.css";
import { shortRigLabel } from "./rig-label";
import { SignOutButton } from "./SignOutButton";

export function PhoneHeader({
  title,
  airbrush,
}: {
  title: string;
  airbrush?: AirbrushRow | null;
}) {
  const [dryTipOpen, setDryTipOpen] = useState(false);

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
          <div className={styles.title}>{title}</div>
        </div>
        {airbrush ? (
          <button
            type="button"
            className={styles.rigPill}
            onClick={() => setDryTipOpen(true)}
            aria-label="Tips & guide for the current rig"
          >
            <span className={styles.rigDot} />
            <span className={styles.rigLabel}>{shortRigLabel(airbrush.model ?? "Rig")}</span>
          </button>
        ) : null}
      </div>

      {dryTipOpen && airbrush ? (
        <Modal title={`${airbrush.model ?? "Rig"} · Tips & Guide`} onClose={() => setDryTipOpen(false)}>
          <DryTipContent airbrush={airbrush} />
        </Modal>
      ) : null}
    </div>
  );
}
