import { splitAtComma, splitValueUnit, thinnerTypeLabel } from "./spec-format";
import styles from "./SpecGrid.module.css";

function NumericTile({ label, text }: { label: string; text: string }) {
  const { value, unit } = splitValueUnit(text);
  return (
    <div className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={styles.combined}>{text}</div>
      <div className={styles.desktopValue}>{value}</div>
      <div className={styles.desktopUnit}>{unit}</div>
    </div>
  );
}

function TextTile({ label, text }: { label: string; text: string }) {
  const lines = splitAtComma(text);
  return (
    <div className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={styles.textCombined}>{lines.join(", ")}</div>
      <div className={styles.desktopLines}>
        {lines.map((line, i) => (
          <span key={line}>
            {line}
            {i < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </div>
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
      <NumericTile label="Pressure" text={psiText ?? "—"} />
      <NumericTile label="Distance" text={distanceText ?? "—"} />
      <TextTile label="Coats" text={coatsText ?? "—"} />
      <TextTile label="Thinner" text={thinnerTypeLabel(thinnerType)} />
    </div>
  );
}
