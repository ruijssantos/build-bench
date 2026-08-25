"use client";

import { useCallback, useRef, useState } from "react";

import { SearchIcon } from "@/components/icons";
import type { PaintHit } from "@/components/thinner/paint-search-index";

import styles from "./InventoryForm.module.css";

/**
 * Which paint you're adding, chosen by type-ahead.
 *
 * Same index and the same `await import()` as the Thinner Bench's search box
 * (docs/PERFORMANCE.md §3), so matching happens in the browser and the
 * catalogue chunk is fetched only once anyone actually opens the Add dialog —
 * which is itself already a lazy chunk. Nothing here reaches the network.
 */

type SearchFn = (query: string, limit?: number) => PaintHit[];

let searchModule: Promise<SearchFn> | null = null;

function loadSearch(): Promise<SearchFn> {
  searchModule ??= import("@/components/thinner/paint-search-index").then((m) => m.searchPaints);
  return searchModule;
}

export function PaintPicker({
  value,
  onPick,
}: {
  value: PaintHit | null;
  onPick: (hit: PaintHit | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PaintHit[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState<SearchFn | null>(null);

  const prime = useCallback(() => {
    // `setSearch(() => fn)` — a bare function argument reads as a state updater.
    if (!search) void loadSearch().then((fn) => setSearch(() => fn));
  }, [search]);

  function runQuery(next: string, fn: SearchFn | null) {
    const trimmed = next.trim();
    if (!trimmed) {
      setHits([]);
      setOpen(false);
      return;
    }
    setOpen(true);
    if (fn) {
      setHits(fn(trimmed));
      return;
    }
    void loadSearch().then((loaded) => {
      setSearch(() => loaded);
      setHits(loaded(trimmed));
    });
  }

  function onChange(next: string) {
    setQuery(next);
    if (value) onPick(null);
    runQuery(next, search);
  }

  function pick(hit: PaintHit) {
    onPick(hit);
    setQuery("");
    setHits([]);
    setOpen(false);
  }

  if (value) {
    return (
      <div className={styles.picked}>
        <span className={styles.pickedSwatch} style={{ background: value.hex ?? "#c7c9d1" }} />
        <span className={styles.pickedCode}>{value.code}</span>
        <span className={styles.pickedName}>{value.name}</span>
        <button
          type="button"
          className={styles.pickedChange}
          onClick={() => {
            onPick(null);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pickerWrap}>
      <div className={styles.pickerBox}>
        <SearchIcon size={17} className={styles.pickerIcon} />
        <input
          ref={inputRef}
          id="inventory-paint-picker"
          className={styles.pickerInput}
          type="text"
          placeholder="XF-1, X-11, LP-2, TS-8…"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls="inventory-paint-hits"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onPointerEnter={prime}
          onFocus={() => {
            prime();
            if (query.trim()) runQuery(query, search);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
      </div>

      {open ? (
        <ul className={styles.pickerHits} id="inventory-paint-hits" role="listbox">
          {hits.length === 0 ? (
            <li className={styles.pickerEmpty}>No match.</li>
          ) : (
            hits.map((hit) => (
              <li
                key={hit.code}
                role="option"
                aria-selected={false}
                className={styles.pickerHit}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(hit);
                }}
              >
                <span className={styles.pickerDot} style={{ background: hit.hex ?? "#c7c9d1" }} />
                <span className={styles.pickerHitCode}>{hit.code}</span>
                <span className={styles.pickerHitName}>{hit.name}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
