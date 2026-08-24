"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/bench/SignOutButton";
import { ThinnerIcon } from "@/components/icons";
import type { AirbrushRow } from "@/db/repositories/airbrush";

import styles from "./NavRail.module.css";
import { NAV_ITEMS } from "./nav-items";

export function NavRail({ airbrush }: { airbrush: AirbrushRow | null }) {
  const pathname = usePathname();

  return (
    <nav className={styles.rail} aria-label="Primary">
      <svg
        className={styles.sweep}
        width="200"
        height="200"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <g transform="rotate(-21 100 100)">
          <rect x="50" y="-60" width="23" height="290" fill="var(--livery-card)" />
          <rect x="79" y="-60" width="9" height="290" fill="var(--livery-card)" />
        </g>
      </svg>

      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <ThinnerIcon size={17} strokeWidth={2.1} />
        </div>
        <span className={styles.brandName}>The Build Bench</span>
      </div>

      <div className={styles.items}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.item} ${active ? styles.itemActive : ""}`}
            >
              <Icon size={19} />
              <span className={styles.itemLabel}>{item.railLabel}</span>
            </Link>
          );
        })}
      </div>

      <div className={styles.spacer} />

      {airbrush ? (
        <div className={styles.rig}>
          <div className={styles.rigLabel}>Current rig</div>
          <div className={styles.rigModel}>{airbrush.model}</div>
          <div className={styles.rigChips}>
            {airbrush.nozzleMm != null ? (
              <span className={styles.rigChip}>{airbrush.nozzleMm} mm</span>
            ) : null}
            {airbrush.cupCc != null ? (
              <span className={styles.rigChip}>{airbrush.cupCc} cc</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.signOut}>
        <SignOutButton />
      </div>
    </nav>
  );
}
