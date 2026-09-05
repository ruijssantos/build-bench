"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SearchIcon } from "@/components/icons";
import styles from "@/components/wishlist/Wishlist.module.css";

/**
 * Runs the two-stage research pipeline — docs/PLAN.md §5.1 stages B and C.
 *
 * The only client component on the Research panel, and it earns that: this is
 * a two-to-three-minute operation costing real money, so it needs an explicit
 * trigger, a progress line that says which stage is running, and a failure
 * message that survives the page not re-rendering.
 *
 * The stages are called in sequence from here rather than chained on the
 * server, which is the whole point of splitting them (§5.1): if stage C fails,
 * the retry button re-runs **only** stage C against the same `jobId` — cents
 * instead of the ~€0.20–0.45 stage B already cost. Holding `jobId` in state
 * here is what makes that retry possible.
 */
export function ResearchRunner({ kitId, hasResearch }: { kitId: number; hasResearch: boolean }) {
  const router = useRouter();
  const [running, startRun] = useTransition();
  const [stage, setStage] = useState<"investigate" | "extract" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Set once stage B has been paid for. Its presence is what turns a retry
   * into a stage-C-only retry. */
  const [jobId, setJobId] = useState<string | null>(null);

  async function post<T>(url: string, body: unknown): Promise<T & { ok: boolean; error?: string }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T & { ok: boolean; error?: string };
  }

  function run() {
    setError(null);
    startRun(async () => {
      try {
        let id = jobId;

        // Skipped entirely when a previous attempt already got through stage
        // B — that write-up is sitting in `research_job.partial` and does not
        // need buying twice.
        if (!id) {
          setStage("investigate");
          const investigated = await post<{ jobId?: string }>(
            "/api/kits/research/investigate",
            { kitId },
          );
          if (!investigated.ok || !investigated.jobId) {
            setError(investigated.error ?? "Research failed — try again.");
            return;
          }
          id = investigated.jobId;
          setJobId(id);
        }

        setStage("extract");
        const extracted = await post("/api/kits/research/extract", { kitId, jobId: id });
        if (!extracted.ok) {
          setError(extracted.error ?? "Filing the research failed — try again.");
          return;
        }

        // Stage C succeeded, so the job is spent — a further run should start
        // fresh rather than re-file the same write-up.
        setJobId(null);
        // The route revalidated its tags, but this was a `fetch` from a client
        // component: nothing re-renders the server tree on its own. Same
        // reason `ManualRow` calls this after extracting a paint list.
        router.refresh();
      } catch {
        setError("Research hit a problem — try again.");
      } finally {
        setStage(null);
      }
    });
  }

  const label = jobId
    ? "Retry filing"
    : hasResearch
      ? "Research again"
      : "Research this kit";

  return (
    <>
      <button
        type="button"
        className={`${styles.boughtButton} ${styles.manualActionButton}`}
        onClick={run}
        disabled={running}
      >
        <SearchIcon size={13} /> {running ? "Researching…" : label}
      </button>

      {running ? (
        <span className={styles.status}>
          <span className={styles.spinner} />
          {stage === "investigate"
            ? "Reading build threads and reviews… this takes a couple of minutes."
            : "Filing what it found…"}
        </span>
      ) : null}

      {error ? (
        <span className={`${styles.status} ${styles.statusError}`} role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
