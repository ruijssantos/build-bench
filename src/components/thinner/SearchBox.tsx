"use client";

import { useRef, useState } from "react";

import { SearchIcon, XIcon } from "@/components/icons";

import styles from "./SearchBox.module.css";

export interface SearchResult {
  code: string;
  name: string | null;
  hex: string | null;
  family: string;
  finish: string | null;
}

export function SearchBox({
  scope,
  query,
  onQueryChange,
  onSubmit,
  suggestions,
  showSuggestions,
  onFocus,
  onBlur,
  onSelect,
}: {
  scope: "phone" | "desktop";
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  suggestions: SearchResult[];
  showSuggestions: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onSelect: (code: string) => void;
}) {
  const wrapperClass = scope === "phone" ? styles.onlyPhone : styles.onlyDesktop;
  const inputId = `thinner-search-${scope}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlighted, setHighlighted] = useState(-1);

  // A fresh set of suggestions (or the dropdown opening/closing) starts with
  // nothing highlighted — adjusted during render (React's documented pattern
  // for this) rather than in an effect, which would cost an extra render.
  const [trackedSuggestions, setTrackedSuggestions] = useState(suggestions);
  const [trackedShown, setTrackedShown] = useState(showSuggestions);
  if (suggestions !== trackedSuggestions || showSuggestions !== trackedShown) {
    setTrackedSuggestions(suggestions);
    setTrackedShown(showSuggestions);
    setHighlighted(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      if (showSuggestions && highlighted >= 0 && suggestions[highlighted]) {
        onSelect(suggestions[highlighted].code);
      } else {
        onSubmit();
      }
      return;
    }
    if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  }

  return (
    <div className={wrapperClass}>
      <div className={styles.wrap}>
        <div className={`${styles.box} ${scope === "desktop" ? styles.boxDesktop : ""}`}>
          <SearchIcon size={scope === "desktop" ? 18 : 19} className={styles.icon} />
          <label
            htmlFor={inputId}
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
          >
            Paint code
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className={styles.input}
            type="text"
            placeholder="XF-1, X-11, LP-2, TS-8…"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls={`${inputId}-hits`}
            aria-activedescendant={highlighted >= 0 ? `${inputId}-hit-${highlighted}` : undefined}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
          />
          {query ? (
            <button
              type="button"
              className={styles.clearButton}
              aria-label="Clear search"
              onMouseDown={(e) => {
                // preventDefault, not onClick: keeps focus on the input rather than
                // blurring to the button, so the dropdown doesn't close first.
                e.preventDefault();
                onQueryChange("");
                inputRef.current?.focus();
              }}
            >
              <XIcon size={scope === "desktop" ? 15 : 16} />
            </button>
          ) : null}
        </div>

        {showSuggestions ? (
          <ul className={styles.hits} id={`${inputId}-hits`} role="listbox">
            {suggestions.length === 0 ? (
              <li className={styles.empty}>No match.</li>
            ) : (
              suggestions.map((p, i) => (
                <li
                  key={p.code}
                  id={`${inputId}-hit-${i}`}
                  role="option"
                  aria-selected={i === highlighted}
                  className={`${styles.hit} ${i === highlighted ? styles.hitActive : ""}`}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(p.code);
                  }}
                >
                  <span className={styles.dot} style={{ background: p.hex ?? "#c7c9d1" }} />
                  <span className={styles.hitCode}>{p.code}</span>
                  <span className={styles.hitName}>{p.name}</span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
