"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
 */
export function NavTabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
      <SignOutButton
        formClassName={styles.signOutItem}
        className={styles.item}
        labelClassName={styles.itemLabel}
        iconSize={22}
      />
    </nav>
  );
}
