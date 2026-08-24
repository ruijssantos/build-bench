"use client";

import { catchError, type ErrorInfo } from "next/error";

import styles from "./BenchError.module.css";

/**
 * A boundary for the parts of a screen that stream in from the database.
 *
 * Streaming changes what a failed query looks like: the shell has already
 * painted, so a thrown error would otherwise take a page the user is already
 * reading and blank it. This keeps the failure inside the box it belongs to
 * and offers a retry, which — since the shell is still mounted — costs the
 * query and nothing else.
 */
// A production build digests the error message, so the copy stays generic on
// purpose — the real error is in the server logs, and guessing at a cause the
// user can't see would only be wrong half the time.
function BenchErrorFallback({ label }: { label: string }, { retry }: ErrorInfo) {
  return (
    <div className={styles.card} role="alert">
      <p className={styles.title}>{label} didn&apos;t load</p>
      <p className={styles.detail}>The database didn&apos;t answer.</p>
      <button type="button" className={styles.retry} onClick={() => retry()}>
        Try again
      </button>
    </div>
  );
}

export const BenchError = catchError(BenchErrorFallback);

/**
 * For chrome that is a convenience rather than the point of the screen — the
 * rig pill, the rail's Current Rig block. If the query fails these render as
 * they do before they arrive: absent. The screen's own content boundary is
 * what tells the user something is wrong; two more error cards in the chrome
 * would only bury it.
 */
export const QuietError = catchError(() => null);
