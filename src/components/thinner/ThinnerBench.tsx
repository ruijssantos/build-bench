"use client";

import { useEffect, useRef, useState } from "react";

import { PhoneHeader } from "@/components/bench/PhoneHeader";
import type { PaintLine, ThinnerBenchBundle } from "@/lib/thinner-bench";

import { AdditiveCard } from "./AdditiveCard";
import { BenchNotes } from "./BenchNotes";
import { RatioHero, type OverrideInput } from "./RatioHero";
import { SearchBox, type SearchResult } from "./SearchBox";
import { SpecGrid } from "./SpecGrid";
import styles from "./ThinnerBench.module.css";
import { ThinnerWarningBanner } from "./ThinnerWarningBanner";

export function ThinnerBench({ initialBundle }: { initialBundle: ThinnerBenchBundle }) {
  const [bundle, setBundle] = useState(initialBundle);
  const [line, setLine] = useState<PaintLine>("acrylic");
  const [query, setQuery] = useState(displayQuery(initialBundle));
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [drops, setDrops] = useState(20);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function displayQuery(b: ThinnerBenchBundle): string {
    if (b.paint?.known) return `${b.paint.code} ${b.paint.name}`;
    return b.query;
  }

  async function loadCode(code: string, nextLine: PaintLine = line) {
    setDrops(20);
    const res = await fetch(`/api/thinner-bench/${encodeURIComponent(code)}?line=${nextLine}`);
    const data: ThinnerBenchBundle = await res.json();
    setBundle(data);
    setQuery(displayQuery(data));
    setShowSuggestions(false);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setShowSuggestions(Boolean(value.trim()));
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      const res = await fetch(`/api/paints/search?q=${encodeURIComponent(value)}`);
      const data = await res.json();
      setSuggestions(data.results ?? []);
    }, 150);
  }

  function onSubmit() {
    if (query.trim()) void loadCode(query.trim());
  }

  function onSelect(code: string) {
    void loadCode(code);
  }

  function toggleLine(next: PaintLine) {
    setLine(next);
    if (bundle.paint?.known) void loadCode(bundle.paint.code, next);
  }

  async function saveOverride(input: OverrideInput) {
    if (!bundle.paint?.known) return;
    const res = await fetch(`/api/thinner-bench/${encodeURIComponent(bundle.paint.code)}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("Failed to save override");
    const data: ThinnerBenchBundle = await res.json();
    setBundle(data);
  }

  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, []);

  const searchProps = {
    query,
    onQueryChange,
    onSubmit,
    suggestions,
    showSuggestions,
    onFocus: () => setShowSuggestions(Boolean(query.trim())),
    onBlur: () => setTimeout(() => setShowSuggestions(false), 120),
    onSelect,
  };

  return (
    <>
      <PhoneHeader title="Thinner Bench" airbrush={bundle.airbrush} />

      <div className={styles.desktopHeader}>
        <div className={styles.desktopTitle}>Thinner Bench</div>
      </div>

      <div className={styles.phoneSearchBlock}>
        <SearchBox scope="phone" {...searchProps} />
      </div>

      {bundle.paint?.ambiguous ? (
        <div className={styles.lineToggle}>
          <button
            type="button"
            className={`${styles.lineButton} ${line === "acrylic" ? styles.lineButtonActive : ""}`}
            onClick={() => toggleLine("acrylic")}
          >
            Acrylic (bottle)
          </button>
          <button
            type="button"
            className={`${styles.lineButton} ${line === "enamel" ? styles.lineButtonActive : ""}`}
            onClick={() => toggleLine("enamel")}
          >
            Enamel (bottle)
          </button>
        </div>
      ) : null}

      <div className={styles.scrollArea}>
        {!bundle.airbrush ? (
          <div className={styles.notice}>
            No airbrush rig is seeded yet — run <code>npm run db:seed</code> to load the catalogue,
            ratio rules and rig facts.
          </div>
        ) : (
          <div className={styles.grid}>
            {/* Single, stable mount point regardless of which branch below is
                active — selecting a result changes `bundle`, which would
                otherwise remount this mid-click if it lived inside a branch. */}
            <div className={styles.searchArea}>
              <SearchBox scope="desktop" {...searchProps} />
            </div>

            {!bundle.paint ? (
              <div className={styles.emptyCard}>
                No match. Tamiya codes look like <b>X-7</b>, <b>XF-64</b>, <b>LP-2</b>, <b>TS-8</b> or{" "}
                <b>AS-12</b>.
              </div>
            ) : bundle.isAdditive ? (
              <div className={styles.heroArea}>
                <AdditiveCard paint={bundle.paint} notes={bundle.ratioRule?.notes ?? []} />
              </div>
            ) : bundle.effectiveRatio ? (
              <>
                <div className={styles.heroArea}>
                  <RatioHero
                    paint={bundle.paint}
                    ratio={bundle.effectiveRatio}
                    cupCc={bundle.airbrush.cupCc ?? 7}
                    drops={drops}
                    onDropsChange={setDrops}
                    canOverride={bundle.paint.known}
                    onSaveOverride={saveOverride}
                  />
                </div>
                <div className={styles.specsArea}>
                  <SpecGrid
                    psiText={bundle.effectiveRatio.psiText}
                    distanceText={bundle.effectiveRatio.distanceText}
                    coatsText={bundle.effectiveRatio.coatsText}
                    thinnerType={bundle.ratioRule?.thinnerType ?? null}
                  />
                </div>
                {bundle.thinnerWarning ? (
                  <div className={styles.warningArea}>
                    <ThinnerWarningBanner warning={bundle.thinnerWarning} />
                  </div>
                ) : null}
                <div className={styles.notesArea}>
                  <BenchNotes notes={bundle.effectiveRatio.notes} />
                </div>
              </>
            ) : (
              <div className={styles.emptyCard}>No ratio rule is seeded for this family yet.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
