import { SignOutButton } from "./SignOutButton";
import styles from "./PhoneHeader.module.css";

export function PhoneHeader({
  title,
  rigLabel,
}: {
  title: string;
  rigLabel?: string | null;
}) {
  return (
    <div className={styles.header}>
      <svg className={styles.sweep} width="230" height="230" viewBox="0 0 230 230" aria-hidden="true">
        <g transform="rotate(-21 115 115)">
          <rect x="58" y="-70" width="26" height="330" fill="var(--livery)" />
          <rect x="90" y="-70" width="10" height="330" fill="var(--livery)" />
        </g>
      </svg>

      <div className={styles.statusBarSpace} />

      <div className={styles.signOut}>
        <SignOutButton iconOnly />
      </div>

      <div className={styles.row}>
        <div>
          <div className={styles.eyebrow}>The Build Bench</div>
          <div className={styles.title}>{title}</div>
        </div>
        {rigLabel ? (
          <div className={styles.rigPill}>
            <span className={styles.rigDot} />
            <span className={styles.rigLabel}>{rigLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
