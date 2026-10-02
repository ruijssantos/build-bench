import Link from "next/link";

import { GUIDES } from "@/guides";

import { Specs } from "./GuideBody";
import styles from "./Guides.module.css";

/** The `/guides` index: one card per guide. */
export function GuideCards() {
  return (
    <div className={styles.cards}>
      {GUIDES.map((g) => (
        <Link key={g.slug} href={`/guides/${g.slug}`} className={styles.card}>
          <span className={styles.topic}>{g.topic}</span>
          <span className={styles.cardTitle}>{g.title}</span>
          <Specs specs={g.specs} />
          <span className={styles.cardSummary}>{g.summary}</span>
          <span className={styles.cardMeta}>{g.sections.length} sections →</span>
        </Link>
      ))}
    </div>
  );
}
