"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import { SearchField } from "@/components/bench/SearchField";

import type { PaintHit } from "./paint-search-index";
import styles from "./SearchBox.module.css";

/**
 * Type-ahead over the paint catalogue.
 *
 * Two things make this fast. Matching happens in the browser against a
 * catalogue chunk loaded on first focus, so there is no request, no debounce
 * and no stale response to race — a keystroke and its results are the same
 * frame. And picking a result is a real navigation to `/thinner?code=…`, which
 * Next can prefetch while the result is merely highlighted, so the screen is
 * usually already rendered by the time it's clicked.
 */

type SearchFn = (query: string, limit?: number) => PaintHit[];

let searchModule: Promise<SearchFn> | null = null;

/** Idempotent: the first caller starts the fetch, everyone else awaits it. */
function loadSearch(): Promise<SearchFn> {
  searchModule ??= import("./paint-search-index").then((m) => m.searchPaints);
  return searchModule;
}

export function SearchBox({ scope, initialQuery }: { scope: "phone" | "desktop"; initialQuery: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<PaintHit[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [search, setSearch] = useState<SearchFn | null>(null);

  // Navigating to another paint re-seeds the box with the resolved label
  // ("TS-8 Italian Red"), unless the user has since typed something else.
  // Adjusting during render is React's documented pattern for this — an
  // effect would cost an extra render on every navigation.
  const [lastInitial, setLastInitial] = useState(initialQuery);
  if (initialQuery !== lastInitial) {
    setLastInitial(initialQuery);
    setQuery(initialQuery);
    setHits([]);
    setOpen(false);
    setHighlighted(-1);
  }

  const wrapperClass = scope === "phone" ? styles.onlyPhone : styles.onlyDesktop;
  const inputId = `thinner-search-${scope}`;

  /** Warms the catalogue chunk before it's needed — focus is the earliest
   * honest signal that someone is about to search. */
  const primeSearch = useCallback(() => {
    // `setSearch(() => fn)`, not `setSearch(fn)` — a bare function argument
    // would be read as a state updater.
    if (!search) void loadSearch().then((fn) => setSearch(() => fn));
  }, [search]);

  const runQuery = useCallback(
    (value: string, fn: SearchFn | null) => {
      const trimmed = value.trim();
      setHighlighted(-1);
      if (!trimmed) {
        setHits([]);
        setOpen(false);
        return;
      }
      setOpen(true);
      if (fn) {
        setHits(fn(trimmed));
      } else {
        // First keystroke landed before the chunk did: fill in when it arrives,
        // as long as the box still holds the query we searched for.
        void loadSearch().then((loaded) => {
          setSearch(() => loaded);
          setHits(loaded(trimmed));
        });
      }
    },
    [],
  );

  function onChange(value: string) {
    setQuery(value);
    runQuery(value, search);
  }

  function go(code: string) {
    setOpen(false);
    startTransition(() => {
      router.push(`/thinner?code=${encodeURIComponent(code)}`);
    });
  }

  /** Highlighting a result is a strong enough signal to render it early. */
  function highlight(index: number) {
    setHighlighted(index);
    const hit = hits[index];
    if (hit) router.prefetch(`/thinner?code=${encodeURIComponent(hit.code)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && open && hits.length > 0) {
      e.preventDefault();
      highlight(Math.min(highlighted + 1, hits.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && open && hits.length > 0) {
      e.preventDefault();
      const next = Math.max(highlighted - 1, -1);
      if (next < 0) setHighlighted(-1);
      else highlight(next);
      return;
    }
    if (e.key === "Enter") {
      if (open && highlighted >= 0 && hits[highlighted]) go(hits[highlighted].code);
      else if (query.trim()) go(query.trim());
      return;
    }
    if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  }

  return (
    <div className={wrapperClass}>
      <div className={styles.wrap}>
        <SearchField
          ref={inputRef}
          id={inputId}
          label="Paint code"
          placeholder="XF-1, X-11, LP-2, TS-8…"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-hits`}
          aria-activedescendant={highlighted >= 0 ? `${inputId}-hit-${highlighted}` : undefined}
          value={query}
          onChange={onChange}
          onClear={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          onPointerEnter={primeSearch}
          onFocus={() => {
            primeSearch();
            if (query.trim()) runQuery(query, search);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />

        {open ? (
          <ul className={styles.hits} id={`${inputId}-hits`} role="listbox">
            {hits.length === 0 ? (
              <li className={styles.empty}>No match.</li>
            ) : (
              hits.map((hit, i) => (
                <li
                  key={hit.code}
                  id={`${inputId}-hit-${i}`}
                  role="option"
                  aria-selected={i === highlighted}
                  className={`${styles.hit} ${i === highlighted ? styles.hitActive : ""}`}
                  onMouseEnter={() => highlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(hit.code);
                  }}
                >
                  <span className={styles.dot} style={{ background: hit.hex ?? "#c7c9d1" }} />
                  <span className={styles.hitCode}>{hit.code}</span>
                  <span className={styles.hitName}>{hit.name}</span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
