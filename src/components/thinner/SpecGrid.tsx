import { thinnerTypeLabel } from "./spec-format";
import styles from "./SpecGrid.module.css";

function Tile({ label, text }: { label: string; text: string }) {
  return (
    <div className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{text}</div>
    </div>
  );
}

export function SpecGrid({
  psiText,
  distanceText,
  coatsText,
  thinnerType,
}: {
  psiText: string | null;
  distanceText: string | null;
  coatsText: string | null;
  thinnerType: string | null;
}) {
  return (
    <div className={styles.grid}>
      <Tile label="Pressure" text={psiText ?? "—"} />
      <Tile label="Distance" text={distanceText ?? "—"} />
      <Tile label="Coats" text={coatsText ?? "—"} />
      <Tile label="Thinner" text={thinnerTypeLabel(thinnerType)} />
    </div>
  );
}
