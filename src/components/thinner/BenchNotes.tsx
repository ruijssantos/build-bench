import ui from "@/styles/ui.module.css";

import styles from "./BenchNotes.module.css";

export function BenchNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className={styles.card}>
      <div className={`${ui.moduleTitle} ${styles.title}`}>On the bench</div>
      <div className={styles.list}>
        {notes.map((note) => (
          <div className={styles.item} key={note}>
            <span className={styles.dot} />
            <span className={styles.text}>{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
