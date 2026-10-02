import type { Guide, GuideBlock, GuideItem } from "@/guides";

import styles from "./Guides.module.css";

/**
 * A guide's article: a summary card, then one card per section. Server-only
 * and static — the content is compiled in, so the whole page prerenders.
 */
export function GuideBody({ guide }: { guide: Guide }) {
  return (
    <article className={styles.article}>
      <header className={styles.hero}>
        <span className={styles.topic}>{guide.topic}</span>
        <h2 className={styles.heroTitle}>{guide.title}</h2>
        <Specs specs={guide.specs} />
        <p className={styles.heroSummary}>{guide.summary}</p>
      </header>

      {guide.sections.map((section) => (
        <section key={section.id} id={section.id} className={styles.section}>
          {section.eyebrow ? <div className={styles.eyebrow}>{section.eyebrow}</div> : null}
          <h3 className={styles.sectionTitle}>{section.title}</h3>
          {section.goal ? <p className={styles.goal}>{section.goal}</p> : null}
          <div className={styles.blocks}>
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

/** The guide's spec chips (nozzle, cup) — shared with the index cards. */
export function Specs({ specs }: { specs?: string[] }) {
  if (!specs?.length) return null;
  return (
    <span className={styles.specs}>
      {specs.map((s) => (
        <span key={s} className={styles.spec}>
          {s}
        </span>
      ))}
    </span>
  );
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p className={styles.paragraph}>{block.text}</p>;

    case "steps":
      return (
        <ol className={styles.steps}>
          {block.items.map((item, i) => (
            <li key={i} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {i + 1}
              </span>
              <Item item={item} />
            </li>
          ))}
        </ol>
      );

    case "bullets":
      return (
        <ul className={styles.bullets}>
          {block.items.map((item, i) => (
            <li key={i} className={styles.bullet}>
              <span className={styles.dot} aria-hidden="true" />
              <Item item={item} />
            </li>
          ))}
        </ul>
      );

    case "setup":
      return (
        <div className={styles.setup}>
          <span className={styles.setupLabel}>Setup</span>
          <span className={styles.setupText}>{block.text}</span>
        </div>
      );

    case "note":
      return (
        <aside className={styles.note}>
          <div className={styles.noteTitle}>{block.title}</div>
          {block.text ? <p className={styles.noteText}>{block.text}</p> : null}
          {block.items ? (
            <ul className={styles.noteList}>
              {block.items.map((item, i) => (
                <li key={i} className={styles.bullet}>
                  <span className={styles.dot} aria-hidden="true" />
                  <Item item={item} />
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      );

    case "table":
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={i}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function Item({ item }: { item: GuideItem }) {
  if (typeof item === "string") return <span className={styles.itemText}>{item}</span>;

  return (
    <div className={styles.itemBody}>
      <span className={styles.itemText}>
        {item.lead ? <strong className={styles.lead}>{item.lead}</strong> : null}
        {item.lead && item.text ? " " : null}
        {item.text}
      </span>
      {item.sub ? (
        <ul className={styles.sub}>
          {item.sub.map((s) => (
            <li key={s} className={styles.subItem}>
              {s}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
