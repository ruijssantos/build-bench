import Link from "next/link";

import { GUIDES, type Guide } from "@/guides";

import styles from "./Guides.module.css";

/**
 * Desktop-only left column on a guide page: every guide, then this guide's
 * sections as jump links. The active guide comes from the page's own slug, not
 * `usePathname`, so this stays a Server Component and prerenders with the page.
 */
export function GuideSidebar({ current }: { current: Guide }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLabel}>Guides</div>
      <nav className={styles.guideList} aria-label="Guides">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className={`${styles.guideLink} ${g.slug === current.slug ? styles.guideLinkActive : ""}`}
            aria-current={g.slug === current.slug ? "page" : undefined}
          >
            <span className={styles.guideLinkTopic}>{g.topic}</span>
            <span className={styles.guideLinkTitle}>{g.title}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.sidebarLabel}>On this page</div>
      <nav className={styles.toc} aria-label="On this page">
        {current.sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>
            {s.eyebrow ? <span className={styles.tocEyebrow}>{s.eyebrow.replace("Stage ", "")}</span> : null}
            {s.title}
          </a>
        ))}
      </nav>
    </aside>
  );
}
