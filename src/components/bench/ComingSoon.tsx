import type { ComponentType } from "react";

import type { IconProps } from "@/components/icons";

import { PhoneHeader } from "./PhoneHeader";
import styles from "./ComingSoon.module.css";

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
      <PhoneHeader title={title} />
      <div className={styles.desktopHeader}>{title}</div>
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
