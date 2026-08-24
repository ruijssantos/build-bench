import { ChevronDownIcon, SearchIcon } from "@/components/icons";

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

  return (
    <div className={wrapperClass}>
      <div className={styles.wrap}>
        <div className={`${styles.box} ${scope === "desktop" ? styles.boxDesktop : ""}`}>
          <SearchIcon size={scope === "desktop" ? 18 : 19} className={styles.icon} />
          <label htmlFor={inputId} className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Paint code
          </label>
          <input
            id={inputId}
            className={styles.input}
            type="text"
            placeholder="XF-1, X-11, LP-2, TS-8…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
          />
          <ChevronDownIcon size={scope === "desktop" ? 16 : 18} className={styles.chevron} />
        </div>

        {showSuggestions ? (
          <ul className={styles.hits}>
            {suggestions.length === 0 ? (
              <li className={styles.empty}>No match.</li>
            ) : (
              suggestions.map((p) => (
                <li
                  key={p.code}
                  className={styles.hit}
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
