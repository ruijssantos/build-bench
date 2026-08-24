import styles from "./login.module.css";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const from = typeof searchParams.from === "string" ? searchParams.from : "";
  const hasError = searchParams.error === "1";

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Bench &amp; Build</p>
        <h1 className={styles.title}>Sign in</h1>

        {hasError ? <p className={styles.error}>Wrong passphrase.</p> : null}

        <form method="POST" action="/api/login">
          <input type="hidden" name="from" value={from} />
          <div className={styles.field}>
            <label className={styles.label} htmlFor="passphrase">
              Passphrase
            </label>
            <input
              className={styles.input}
              id="passphrase"
              name="passphrase"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>
          <button className={styles.button} type="submit">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
