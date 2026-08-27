"use client";

import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";

import { SearchField } from "@/components/bench/SearchField";
import { PlusIcon } from "@/components/icons";
import { NAV_RECLICK_EVENT } from "@/components/nav/nav-events";
import type { KitCandidate } from "@/domain/kit-candidate";

import { KitCandidateCard } from "./KitCandidateCard";
import styles from "./Wishlist.module.css";

const ManualKitDialog = lazy(() => import("./ManualKitDialog").then((m) => ({ default: m.ManualKitDialog })));

type ResolveResponse = { ok: true; candidates: KitCandidate[] } | { ok: false; error: string };

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  /** `run` is a per-search sequence number, used only to key the card grid —
   * see the note where it's rendered. */
  | { status: "done"; run: number; query: string; candidates: KitCandidate[] };

/**
 * The kit search — docs/PLAN.md §5.1 stage A, §6 Phase 3.
 *
 * Submit-triggered, not type-ahead: unlike the paint catalogue
 * (docs/PERFORMANCE.md §3), there's no free local index behind this — every
 * search is a real, paid ~10–20s call to `/api/kits/resolve`. Manual entry
 * sits in the same card, always reachable, never behind a failed or even an
 * attempted search.
 */
export function KitSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [runs, setRuns] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);

  /** Back to a blank box — the search's own × clears it, and re-clicking the
   * Wishlist nav tab (see `nav-events.ts`) does the same, since neither a
   * saved candidate nor a dismissed error should linger once you're done
   * with them. */
  function reset() {
    setQuery("");
    setState({ status: "idle" });
  }

  useEffect(() => {
    function onNavClick(e: Event) {
      if ((e as CustomEvent<string>).detail === "/wishlist") reset();
    }
    window.addEventListener(NAV_RECLICK_EVENT, onNavClick);
    return () => window.removeEventListener(NAV_RECLICK_EVENT, onNavClick);
  }, []);

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || state.status === "loading") return;

    const run = runs + 1;
    setRuns(run);
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/kits/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = (await res.json()) as ResolveResponse;
      if (!data.ok) {
        setState({ status: "error", message: data.error });
        return;
      }
      setState({ status: "done", run, query: trimmed, candidates: data.candidates });
    } catch {
      setState({ status: "error", message: "Search hit a problem — try again." });
    }
  }

  const loading = state.status === "loading";

  return (
    <div className={styles.searchCard}>
      <form className={styles.searchForm} onSubmit={(e) => void search(e)}>
        <SearchField
          id="kit-search-input"
          label="Search for a kit by number or name"
          placeholder="Brand and kit number for accurate results"
          value={query}
          onChange={setQuery}
          onClear={reset}
          disabled={loading}
        />
        <div className={styles.searchActions}>
          <button type="submit" className={styles.searchButton} disabled={loading || !query.trim()}>
            {loading ? "Searching…" : "Search"}
          </button>
          <button type="button" className={styles.manualButton} onClick={() => setManualOpen(true)}>
            <PlusIcon size={11} /> Add Manually
          </button>
        </div>
      </form>

      {/* One live region for all three outcomes: a submit whose result takes
          20s to arrive is exactly the case a screen reader has to be told
          about, since nothing about the page moves in the meantime. */}
      <div role="status" aria-live="polite">
        {state.status === "loading" ? (
          <div className={styles.status}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>Searching Scalemates and the web…</span>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className={`${styles.status} ${styles.statusError}`}>{state.message}</div>
        ) : null}

        {state.status === "done" && state.candidates.length === 0 ? (
          <div className={styles.status}>
            No matches for &ldquo;{state.query}&rdquo;. Try different terms, or add it manually.
          </div>
        ) : null}
      </div>

      {state.status === "done" && state.candidates.length > 0 ? (
        <div className={styles.resultsBlock}>
          <div className={styles.subHead}>
            <span className={styles.moduleTitle}>Search results</span>
            <span className={styles.moduleMeta}>
              {state.candidates.length} found
            </span>
          </div>
          {/* Keyed by search run, not by candidate content. Two searches for
              the same kit produce the same brand and number, so a content
              key let React reuse the previous card instance — and with it
              that card's "Saved" state, showing a fresh result as already
              saved with no way to save it. */}
          <div className={styles.cardGrid}>
            {state.candidates.map((candidate, i) => (
              <KitCandidateCard key={`${state.run}-${i}`} candidate={candidate} />
            ))}
          </div>
        </div>
      ) : null}

      {manualOpen ? (
        <Suspense fallback={null}>
          <ManualKitDialog onClose={() => setManualOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}
