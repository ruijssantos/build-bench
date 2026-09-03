import { toggleResearchVerified } from "@/app/(bench)/kits/actions";
import { CheckIcon, ExternalLinkIcon } from "@/components/icons";
import inventoryStyles from "@/components/inventory/Inventory.module.css";
import styles from "@/components/wishlist/Wishlist.module.css";
import { getKitResearch } from "@/db/repositories/kit-research";
import type { KitRow } from "@/db/repositories/kits";
import { formatTimestampDate } from "@/domain/dates";
import { consensusLine, severityLabel, sourceHost, tipCategoryLabel } from "@/domain/kit-research";

import { ResearchRunner } from "./ResearchRunner";

/**
 * What other builders say about this kit — docs/PLAN.md §5.1 stages B and C,
 * §5.4, §6 Phase 7.
 *
 * Every rule this panel follows comes from §5.4, and they are all the same
 * rule: **this is synthesised from forum posts, and it must never read like
 * reference data.** So a claim always renders its source as a clickable host
 * beside it; difficulty appears only as "Intermediate · consensus from 4
 * sources", never as a bare word; and a Verify tick — the one thing here the
 * owner asserts rather than a model — visibly outranks the rest.
 *
 * A Server Component. The only client JavaScript on this panel is the run
 * button, which has to be (it drives a two-stage pipeline that takes minutes);
 * Verify is a plain form action, and everything below is server-rendered text.
 */
export async function ResearchPanel({ kit }: { kit: KitRow }) {
  const research = await getKitResearch(kit.id);

  if (!research) {
    return (
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <span className={styles.moduleTitle}>Research</span>
          <div className={inventoryStyles.emptyCard}>
            Search the web for what builders say about this kit — difficulty, fit issues to expect,
            and tips. Takes a couple of minutes and costs a little.
          </div>
          <div className={styles.manualActions}>
            <ResearchRunner kitId={kit.id} hasResearch={false} />
          </div>
        </div>
      </div>
    );
  }

  const issues = research.fitIssues ?? [];
  const tips = research.tips ?? [];
  const consensus = consensusLine(research.difficulty, research.sources?.length ?? 0);
  const verified = research.verifiedByMe === true;

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.subHead}>
          <span className={styles.moduleTitle}>Research</span>
          {/* Never a bare rating — §5.4. If there is no difficulty, or nothing
              was cited, this renders nothing at all rather than a word with
              no backing. */}
          {consensus ? <span className={styles.moduleMeta}>{consensus}</span> : null}
        </div>

        {/* The standing caveat, not a one-off notice: everything below is a
            language model's reading of forum posts. Stated once, at the top,
            where it frames the whole panel. */}
        <p className={styles.researchCaveat}>
          Gathered from builders&rsquo; posts and reviews by Claude on{" "}
          {formatTimestampDate(research.researchedAt) ?? "an earlier run"}. Follow a source link
          before trusting anything here.
        </p>

        {research.difficultyNote ? (
          <p className={styles.researchNote}>{research.difficultyNote}</p>
        ) : null}

        {issues.length > 0 ? (
          <div className={styles.paintBucket}>
            <div className={styles.bucketHead}>
              <span className={`${styles.bucketDot} ${styles.bucketDotMissing}`} />
              <span className={styles.moduleTitle}>Watch out for ({issues.length})</span>
            </div>
            {issues.map((issue) => (
              <div key={issue.sourceUrl + issue.issue} className={styles.claimRow}>
                <span className={styles.claimText}>{issue.issue}</span>
                <span className={styles.claimMeta}>
                  <span className={styles.claimTag}>{severityLabel(issue.severity)}</span>
                  <a
                    className={styles.claimSource}
                    href={issue.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {sourceHost(issue.sourceUrl)} <ExternalLinkIcon size={11} />
                  </a>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {tips.length > 0 ? (
          <div className={styles.paintBucket}>
            <div className={styles.bucketHead}>
              <span className={`${styles.bucketDot} ${styles.bucketDotOwned}`} />
              <span className={styles.moduleTitle}>Tips ({tips.length})</span>
            </div>
            {tips.map((tip) => (
              <div key={tip.sourceUrl + tip.tip} className={styles.claimRow}>
                <span className={styles.claimText}>{tip.tip}</span>
                <span className={styles.claimMeta}>
                  <span className={styles.claimTag}>{tipCategoryLabel(tip.category)}</span>
                  <a
                    className={styles.claimSource}
                    href={tip.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {sourceHost(tip.sourceUrl)} <ExternalLinkIcon size={11} />
                  </a>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {issues.length === 0 && tips.length === 0 ? (
          <div className={inventoryStyles.emptyCard}>
            Nothing specific turned up for this kit that could be sourced.
          </div>
        ) : null}

        {/* No link-out buttons here. `IdentityPanel` already carries Scalemates
            and a YouTube search at the top of this page, and the Manuals panel
            holds the real, uploaded instructions — so a "build video" or an
            "instructions online" button lower down is a second route to
            something the page already reaches. Research doesn't look for
            either any more (§7); what it produces is claims, and every one of
            them carries its own source link. */}
        <div className={styles.manualActions}>
          {/* §5.4: verified rows outrank unverified, and this is the control
              that says so. `.boughtButtonDone` is the app's existing green
              "already done" state — the same one a bought kit wears. */}
          <form action={toggleResearchVerified}>
            <input type="hidden" name="id" value={research.id} />
            <input type="hidden" name="kitId" value={kit.id} />
            <input type="hidden" name="verified" value={verified ? "1" : "0"} />
            <button
              type="submit"
              className={`${styles.boughtButton} ${verified ? styles.boughtButtonDone : styles.manualActionButton}`}
              aria-pressed={verified}
              title={verified ? "Un-verify this research" : "Mark this research as checked by you"}
            >
              <CheckIcon size={13} /> {verified ? "Verified by you" : "Verify"}
            </button>
          </form>

          <ResearchRunner kitId={kit.id} hasResearch />
        </div>
      </div>
    </div>
  );
}
