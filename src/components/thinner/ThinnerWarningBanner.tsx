import { AlertIcon } from "@/components/icons";
import type { ThinnerWarning } from "@/domain/ratio";

import styles from "./ThinnerWarningBanner.module.css";

export function ThinnerWarningBanner({ warning }: { warning: ThinnerWarning }) {
  return (
    <div className={styles.banner}>
      <AlertIcon size={18} className={styles.icon} />
      <div>
        <div className={styles.title}>{warning.title}</div>
        <div className={styles.message}>{warning.message}</div>
      </div>
    </div>
  );
}
