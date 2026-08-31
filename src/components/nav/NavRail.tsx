"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { SignOutButton } from "@/components/bench/SignOutButton";
import { ThinnerIcon } from "@/components/icons";

import { dispatchNavClick } from "./nav-events";
import styles from "./NavRail.module.css";
import { NAV_ITEMS } from "./nav-items";

/**
 * Client only for `usePathname` — the active-link highlight is the one thing
 * on this rail that has to react to navigation. `rig` arrives as an already
 * rendered Server Component (see NavRailRig), so the Tips & Guide text stays
 * off the client entirely.
 *
 * The items themselves sit behind their own inner `<Suspense>`
 * (`NavItemsActive`): `usePathname()` returns the exact current path, which
 * is build-time-known for every static route but genuinely request-time
 * data on a dynamic one (`/kits/[id]`, docs/PLAN.md §6 Phase 4a — this
 * app's first). Without the boundary, Next refuses to prerender *any* page
 * under a dynamic segment, since the shared layout this rail lives in sits
 * above every route. The fallback (`NavItems` with no pathname) renders
 * instantly and resolves to the same markup on every static route — nothing
 * changes there; only a dynamic-segment page ever streams the highlight in
 * a beat later.
 */
export function NavRail({ rig }: { rig: ReactNode }) {
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
        <Suspense fallback={<NavItems pathname={null} />}>
          <NavItemsActive />
        </Suspense>
      </div>

      <div className={styles.spacer} />

      {rig}

      <div className={styles.signOut}>
        <SignOutButton />
      </div>
    </nav>
  );
}

function NavItemsActive() {
  const pathname = usePathname();
  return <NavItems pathname={pathname} />;
}

function NavItems({ pathname }: { pathname: string | null }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`${styles.item} ${active ? styles.itemActive : ""}`}
            onClick={() => dispatchNavClick(item.href)}
          >
            <Icon size={19} />
            <span className={styles.itemLabel}>{item.railLabel}</span>
          </Link>
        );
      })}
    </>
  );
}
