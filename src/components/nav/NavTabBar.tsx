"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { SignOutButton } from "@/components/bench/SignOutButton";

import { dispatchNavClick } from "./nav-events";
import styles from "./NavTabBar.module.css";
import { NAV_ITEMS } from "./nav-items";

/**
 * Sign out rides along as this bar's sixth tab, not a separate corner icon
 * — one reachable control instead of two. It isn't in `NAV_ITEMS`: that list
 * is shared with `NavRail`, which already has its own full "Sign out" row,
 * and a route-shaped nav item is the wrong model for an action with no page
 * of its own anyway.
 *
 * The tabs sit behind their own inner `<Suspense>` — same reasoning as
 * `NavRail`'s own `NavItemsActive`: `usePathname()` is genuinely
 * request-time data on a dynamic route (`/kits/[id]`), and this bar lives in
 * the shared layout above every route under it.
 */
export function NavTabBar() {
  return (
    <nav className={styles.bar} aria-label="Primary">
      <Suspense fallback={<NavTabs pathname={null} />}>
        <NavTabsActive />
      </Suspense>
      <SignOutButton
        formClassName={styles.signOutItem}
        className={styles.item}
        labelClassName={styles.itemLabel}
        iconSize={22}
      />
    </nav>
  );
}

function NavTabsActive() {
  const pathname = usePathname();
  return <NavTabs pathname={pathname} />;
}

function NavTabs({ pathname }: { pathname: string | null }) {
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
            <Icon size={22} />
            <span className={styles.itemLabel}>{item.tabLabel}</span>
          </Link>
        );
      })}
    </>
  );
}
