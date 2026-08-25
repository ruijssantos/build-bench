"use client";

import { lazy, Suspense, useState, type FormEvent } from "react";

import { PlusIcon, SearchIcon } from "@/components/icons";

import { KitCandidateCard } from "./KitCandidateCard";
import type { KitCandidate } from "./kit-candidate";
import styles from "./Wishlist.module.css";

const ManualKitDialog = lazy(() => import("./ManualKitDialog").then((m) => ({ default: m.ManualKitDialog })));

interface ResolveResponse {
  ok: boolean;
  candidates?: KitCandidate[];
  error?: string;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; query: string; candidates: KitCandidate[] };

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
  const [manualOpen, setManualOpen] = useState(false);

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || state.status === "loading") return;

    setState({ status: "loading" });
    try {
      const res = await fetch("/api/kits/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = (await res.json()) as ResolveResponse;
      if (!data.ok) {
        setState({ status: "error", message: data.error ?? "Search hit a problem — try again." });
        return;
      }
      setState({ status: "done", query: trimmed, candidates: data.candidates ?? [] });
    } catch {
      setState({ status: "error", message: "Search hit a problem — try again." });
    }
  }

  const loading = state.status === "loading";

  return (
    <div className={styles.searchCard}>
      <form className={styles.searchRow} onSubmit={(e) => void search(e)}>
        <div className={styles.searchBox}>
          <SearchIcon size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Kit number or name — “24345”, “Tamiya Nissan GT-R”…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
        </div>
        <button type="submit" className={styles.searchButton} disabled={loading || !query.trim()}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className={styles.searchFooter}>
        <span className={styles.hint}>
          Real kits only, found by web search — can take up to 20 seconds.
        </span>
        <button type="button" className={styles.manualButton} onClick={() => setManualOpen(true)}>
          <PlusIcon size={11} /> Add a kit by hand
        </button>
      </div>

      {state.status === "loading" ? (
        <div className={styles.status}>
          <span className={styles.spinner} aria-hidden="true" />
          <span>Searching Scalemates and the web…</span>
        </div>
      ) : null}

      {state.status === "error" ? <div className={`${styles.status} ${styles.statusError}`}>{state.message}</div> : null}

      {state.status === "done" && state.candidates.length === 0 ? (
        <div className={styles.status}>No matches for &ldquo;{state.query}&rdquo;. Try different terms, or add it by hand.</div>
      ) : null}

      {state.status === "done" && state.candidates.length > 0 ? (
        <div className={styles.cardGrid}>
          {state.candidates.map((candidate, i) => (
            <KitCandidateCard key={`${candidate.brand}-${candidate.kitNumber}-${i}`} candidate={candidate} />
          ))}
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
