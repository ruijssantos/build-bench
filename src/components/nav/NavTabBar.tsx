"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { dispatchNavClick } from "./nav-events";
import styles from "./NavTabBar.module.css";
import { NAV_ITEMS } from "./nav-items";

/**
 * Routes only. Sign out used to ride along as an extra tab here; it now sits
 * as an icon in `PhoneHeader`'s top-right corner, which keeps this bar to
 * the screens themselves.
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
