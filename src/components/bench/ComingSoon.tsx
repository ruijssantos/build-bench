import type { ComponentType } from "react";

import type { IconProps } from "@/components/icons";

import { DesktopHeader } from "./DesktopHeader";
import { PhoneHeader, PhoneHeaderRigPill } from "./PhoneHeader";
import styles from "./ComingSoon.module.css";

/**
 * Fully static: these screens have nothing to fetch, so they prerender whole
 * and a tab-bar tap into one is instant.
 */
export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: ComponentType<IconProps>;
}) {
  return (
    <>
      <PhoneHeader title={title} trailing={<PhoneHeaderRigPill />} />
      <DesktopHeader title={title} />
      <div className={styles.body}>
        <div className={styles.card}>
          <Icon size={28} className={styles.icon} />
          <p className={styles.title}>Not built yet</p>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
    </>
  );
}
