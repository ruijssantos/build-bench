import { CameraIcon, ExternalLinkIcon, PlayIcon } from "@/components/icons";
import styles from "@/components/kits/Kits.module.css";
import type { KitRow } from "@/db/repositories/kits";
import { referenceLinks } from "@/domain/kit-references";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

/**
 * Where to look while building: other people's builds of this kit, and photos
 * of the real thing, by what's worth seeing for its category (a car's cockpit,
 * a bike's controls, a tank's running gear — `src/domain/kit-references.ts`).
 *
 * Links rather than pictures, for now: they cost nothing, can't break, and
 * the photo search is one tap away. Each row shows what it searches for, so a
 * vague kit name is visible as the reason a search came back vague.
 */
export function ReferencesPanel({ kit }: { kit: KitRow }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <span className={ui.moduleTitle}>References</span>
        <div className={styles.referenceList}>
          {referenceLinks(kit).map((link) => (
            <a
              key={link.label}
              className={`${page.itemRow} ${styles.referenceRow}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.manualIcon}>
                {link.where === "YouTube" ? <PlayIcon size={16} /> : <CameraIcon size={16} />}
              </span>
              <span className={page.itemBody}>
                <span className={page.itemTitle}>{link.label}</span>
                <span className={page.itemNotes}>
                  {link.where} · {link.query}
                </span>
              </span>
              <ExternalLinkIcon size={16} className={styles.referenceIcon} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
