"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { searchKitUpgrades } from "@/app/(bench)/kits/actions";
import { SearchIcon } from "@/components/icons";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

/**
 * The Upgrades panel's client half — docs/PLAN.md §5.1.
 *
 * The search itself runs on the server, after the response (`searchKitUpgrades`,
 * and on every add); so this is a button that starts one and a refresher that
 * watches it. Neither holds the run's state: the job row does, which is why
 * leaving the page and coming back shows the same thing.
 */
export function UpgradesButton({ kitId, label }: { kitId: number; label: string }) {
  const router = useRouter();
  const [starting, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const result = await searchKitUpgrades(kitId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The action wrote a job row but touched no cache tag — the panel's
      // job read is uncached — so re-render to show it running.
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className={`${ui.btn} ${ui.btnSm}`} onClick={run} disabled={starting}>
        <SearchIcon size={14} /> {starting ? "Starting…" : label}
      </button>
      {error ? (
        <span className={`${page.status} ${page.statusError}`} role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

/** How often a running search is re-checked. A run takes one to three
 * minutes; every 15s is prompt enough and costs one uncached row read. */
const POLL_MS = 15_000;

/** Re-renders the page while a search runs, so the list replaces the spinner
 * without a reload. Renders nothing; unmounts — and stops — once the panel
 * stops rendering it. */
export function RefreshWhileRunning() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
