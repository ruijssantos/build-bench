import { Suspense } from "react";

import styles from "./login.module.css";

/**
 * The card, the form and the passphrase field are identical for everyone, so
 * they prerender and a CDN serves them. Only the two things the URL decides —
 * where to send you afterwards, and whether the last attempt failed — resolve
 * per request, and neither needs any I/O to do it.
 */
export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>The Build Bench</p>
        <h1 className={styles.title}>Sign in</h1>

        <Suspense fallback={null}>
          <WrongPassphraseNotice searchParams={props.searchParams} />
        </Suspense>

        <form method="POST" action="/api/login">
          {/* Hidden, so filling it in never moves anything on the page. */}
          <Suspense fallback={null}>
            <ReturnToField searchParams={props.searchParams} />
          </Suspense>
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

type LoginSearchParams = Pick<PageProps<"/login">, "searchParams">;

async function WrongPassphraseNotice({ searchParams }: LoginSearchParams) {
  const { error } = await searchParams;
  if (error !== "1") return null;
  return <p className={styles.error}>Wrong passphrase.</p>;
}

async function ReturnToField({ searchParams }: LoginSearchParams) {
  const { from } = await searchParams;
  return <input type="hidden" name="from" value={typeof from === "string" ? from : ""} />;
}
