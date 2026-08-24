import type { ComponentType } from "react";

import type { IconProps } from "@/components/icons";
import type { AirbrushRow } from "@/db/repositories/airbrush";

import { PhoneHeader } from "./PhoneHeader";
import styles from "./ComingSoon.module.css";

export function ComingSoon({
  title,
  description,
  icon: Icon,
  airbrush,
}: {
  title: string;
  description: string;
  icon: ComponentType<IconProps>;
  airbrush: AirbrushRow | null;
}) {
  return (
    <>
      <PhoneHeader title={title} airbrush={airbrush} />
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
