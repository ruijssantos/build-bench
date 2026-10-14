import { ExternalLinkIcon } from "@/components/icons";
import styles from "@/components/kits/Kits.module.css";
import { getKitUpgrades, getLatestUpgradesJob, type KitUpgradesRow } from "@/db/repositories/kit-upgrades";
import { formatTimestampDate } from "@/domain/dates";
import {
  formatCost,
  runCostUsd,
  sourceHost,
  upgradeKindLabel,
  upgradesJobState,
  type UpgradesJobState,
} from "@/domain/kit-upgrades";
import page from "@/styles/page.module.css";
import ui from "@/styles/ui.module.css";

import { RefreshWhileRunning, UpgradesButton } from "./UpgradesControls";

/**
 * Aftermarket parts made for this kit — docs/PLAN.md §5.1, §5.4.
 *
 * Four states, all read from the server, because the search runs there and
 * nobody's browser is waiting on it: running (a search started when the kit
 * was added, or by the button), failed (its reason, and Try again), found (the
 * list), and never searched — a kit added before this existed.
 *
 * A previous answer stays on screen while a new search runs or after one
 * fails: it cost money, and it is still the best list there is.
 *
 * A Server Component; the client half is the button and the refresher.
 */
export async function UpgradesPanel({ kitId }: { kitId: number }) {
  // `getKitUpgrades` first: it pins this render to request time, which the
  // uncached job read below relies on.
  const found = await getKitUpgrades(kitId);
  const job = await getLatestUpgradesJob(kitId);
  const now = new Date();
  return <UpgradesCard kitId={kitId} found={found} state={upgradesJobState(job, now)} now={now} />;
}

/** The panel itself, given what it shows — no reads, so every state renders
 * from plain values. */
function UpgradesCard({
  kitId,
  found,
  state,
  now,
}: {
  kitId: number;
  found: KitUpgradesRow | undefined;
  state: UpgradesJobState;
  now: Date;
}) {
  const upgrades = found?.upgrades ?? [];

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <span className={ui.moduleTitle}>{upgrades.length > 0 ? `Upgrades (${upgrades.length})` : "Upgrades"}</span>

        {found ? (
          // The standing caveat (§5.4), and the cost — the owner's condition
          // for searching on every add was that it stay visible.
          <p className={styles.upgradesCaveat}>
            Found by Claude on {formatTimestampDate(found.researchedAt) ?? "an earlier run"} in makers&rsquo; and
            shops&rsquo; pages, for about {formatCost(runCostUsd(found.usage))}. Ordered by how many sites list each —
            popularity, not a verdict.
          </p>
        ) : null}

        {upgrades.length > 0 ? (
          // A bordered list, as in the approved mock — not edge to edge like
          // References, because the action row sits beneath it.
          <div className={page.itemList}>
            {upgrades.map((upgrade) => (
              <div key={`${upgrade.maker}|${upgrade.code ?? upgrade.name}`} className={page.itemRow}>
                <div className={page.itemBody}>
                  <span className={styles.cardBrand}>
                    {[upgrade.maker, upgradeKindLabel(upgrade.kind)].filter(Boolean).join(" · ")}
                  </span>
                  {/* The kit card's own name style, not `itemTitle`: a product
                      name runs long and is worth two lines, not an ellipsis. */}
                  <span className={styles.cardName}>
                    {upgrade.code && !upgrade.name.includes(upgrade.code) ? `${upgrade.name} ${upgrade.code}` : upgrade.name}
                  </span>
                  {upgrade.adds ? <p className={styles.upgradeAdds}>{upgrade.adds}</p> : null}
                  <span className={styles.claimMeta}>
                    <span className={styles.claimTag}>
                      {upgrade.sourceUrls.length} {upgrade.sourceUrls.length === 1 ? "site" : "sites"}
                    </span>
                    {upgrade.sourceUrls.map((url) => (
                      <a key={url} className={styles.claimSource} href={url} target="_blank" rel="noopener noreferrer">
                        {sourceHost(url)} <ExternalLinkIcon size={11} />
                      </a>
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : found ? (
          <div className={page.emptyCard}>
            Nothing made for this kit turned up. Plenty of kits have no aftermarket — or it&rsquo;s too new to be
            listed yet.
          </div>
        ) : state.state === "idle" ? (
          <div className={page.emptyCard}>
            Search makers&rsquo; and shops&rsquo; pages for detail-up sets, photo-etch, decals and wheels made for
            this kit. Takes a couple of minutes and costs a little.
          </div>
        ) : null}

        <div className={`${styles.manualActions} ${styles.upgradesActions}`}>
          {state.state === "running" ? (
            <span className={page.status}>
              <span className={page.spinner} />
              {state.stage === "investigate" ? "Finding upgrades made for this kit…" : "Filing what it found…"}
              {startedAgo(state.startedAt, now)}
              <RefreshWhileRunning />
            </span>
          ) : state.state === "failed" ? (
            <>
              <UpgradesButton kitId={kitId} label="Try again" />
              <span className={`${page.status} ${page.statusError}`} role="alert">
                {state.error}
              </span>
            </>
          ) : (
            <UpgradesButton kitId={kitId} label={found ? "Search again" : "Find upgrades"} />
          )}
        </div>
      </div>
    </div>
  );
}

/** " Started 2 min ago." — so a search that is taking a while says so, and
 * one that's been going for ages reads as stuck before the stall rule says it. */
function startedAgo(startedAt: Date | null, now: Date): string {
  if (!startedAt) return "";
  const minutes = Math.floor((now.getTime() - startedAt.getTime()) / 60_000);
  return minutes < 1 ? " Started just now." : ` Started ${minutes} min ago.`;
}
