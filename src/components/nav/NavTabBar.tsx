"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { dispatchNavClick } from "./nav-events";
import styles from "./NavTabBar.module.css";
import { NAV_ITEMS } from "./nav-items";

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
    </nav>
  );
}
