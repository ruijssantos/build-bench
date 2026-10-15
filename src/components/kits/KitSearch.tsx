"use client";

import { lazy, useEffect, useRef, useState, type FormEvent } from "react";

import { DialogTrigger } from "@/components/bench/DialogTrigger";
import { SearchField } from "@/components/bench/SearchField";
import { NAV_RECLICK_EVENT } from "@/components/nav/nav-events";
import type { KitStatus } from "@/domain/kit";
import type { KitCandidate } from "@/domain/kit-candidate";
import type { Result } from "@/lib/result";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

import { KitCandidateCard } from "./KitCandidateCard";
import styles from "./Kits.module.css";

const ManualKitDialog = lazy(() => import("./ManualKitDialog").then((m) => ({ default: m.ManualKitDialog })));

type ResolveResponse = Result<{ candidates: KitCandidate[] }>;

type SearchState =
  | { status: "idle" }
  /** Search pressed with nothing typed — a nudge, not an error. */
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  /** `run` is a per-search sequence number, used only to key the card grid —
   * see the note where it's rendered. */
  | { status: "done"; run: number; query: string; candidates: KitCandidate[] };

/**
 * The kit search — docs/PLAN.md §5.1 stage A, §6 Phase 3.
 *
 * The field and Search share one row, and manual entry is a quiet link under
 * them: search is what happens nearly every time, typing a kit in by hand
 * is the fallback when it can't find one. Search is never disabled — a big
 * greyed-out primary was the loudest thing on the screen while doing
 * nothing — so pressing it empty says what to type instead.
 *
 * Submit-triggered, not type-ahead: unlike the paint catalogue
 * (docs/PERFORMANCE.md §3), there's no free local index behind this — every
 * search is a real, paid ~10–20s call to `/api/kits/resolve`. Manual entry
 * sits in the same card, always reachable, never behind a failed or even an
 * attempted search.
 *
 * Shared by the Wishlist and the Stash — `saveStatus` picks which status a
 * result or a hand-entered kit saves into, and `homeHref` is which nav
 * item's re-click should reset this instance back to a blank box (§7: the
 * wishlist's own `NAV_RECLICK_EVENT` reset never distinguished screens
 * before there were two of them to tell apart).
 */
export function KitSearch({ saveStatus, homeHref }: { saveStatus: KitStatus; homeHref: string }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [runs, setRuns] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
      if ((e as CustomEvent<string>).detail === homeHref) reset();
    }
    window.addEventListener(NAV_RECLICK_EVENT, onNavClick);
    return () => window.removeEventListener(NAV_RECLICK_EVENT, onNavClick);
  }, [homeHref]);

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (state.status === "loading") return;
    if (!trimmed) {
      setState({ status: "empty" });
      inputRef.current?.focus();
      return;
    }

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
      <div className={styles.searchBar}>
        <form className={styles.searchForm} onSubmit={(e) => void search(e)}>
          <SearchField
            ref={inputRef}
            id="kit-search-input"
            label="Search for a kit by number or name"
            placeholder="Brand and kit number"
            value={query}
            onChange={setQuery}
            onClear={reset}
            disabled={loading}
          />
          <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
        <p className={styles.searchManual}>
          Can&rsquo;t find it?{" "}
          <DialogTrigger dialog={ManualKitDialog} dialogProps={{ defaultStatus: saveStatus }} className={ui.textBtn}>
            Add it manually
          </DialogTrigger>
        </p>
      </div>

      {/* One live region for all three outcomes: a submit whose result takes
          20s to arrive is exactly the case a screen reader has to be told
          about, since nothing about the page moves in the meantime. */}
      <div role="status" aria-live="polite" className={styles.searchStatus}>
        {state.status === "loading" ? (
          <div className={page.status}>
            <span className={page.spinner} aria-hidden="true" />
            <span>Searching Scalemates and the web…</span>
          </div>
        ) : null}

        {state.status === "empty" ? (
          <div className={page.status}>Type a brand and kit number to search, e.g. &ldquo;Tamiya 24345&rdquo;.</div>
        ) : null}

        {state.status === "error" ? (
          <div className={`${page.status} ${page.statusError}`}>{state.message}</div>
        ) : null}

        {state.status === "done" && state.candidates.length === 0 ? (
          <div className={page.status}>
            No matches for &ldquo;{state.query}&rdquo;. Try different terms, or add it manually.
          </div>
        ) : null}
      </div>

      {state.status === "done" && state.candidates.length > 0 ? (
        <div className={styles.resultsBlock}>
          <div className={page.subHead}>
            <span className={ui.moduleTitle}>Search results</span>
            <span className={page.moduleMeta}>
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
              <KitCandidateCard key={`${state.run}-${i}`} candidate={candidate} status={saveStatus} />
            ))}
          </div>
        </div>
      ) : null}

    </div>
  );
}
