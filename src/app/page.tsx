import styles from "./home.module.css";

export default function HomePage() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Bench &amp; Build</p>
        <h1 className={styles.title}>You&apos;re in</h1>
        <p className={styles.body}>
          Phase 0 — foundations. The Thinner Bench and everything else start landing in Phase 1.
        </p>
        <form method="POST" action="/api/logout">
          <button className={styles.logout} type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
