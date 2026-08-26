"use client";

import { useState } from "react";

import { saveKitCandidate } from "@/app/(bench)/wishlist/actions";
import { CheckIcon } from "@/components/icons";
import type { KitCandidate } from "@/domain/kit-candidate";

import { KitCardBody } from "./KitCardBody";
import styles from "./Wishlist.module.css";

/** One search result, with the button that saves it — docs/PLAN.md §5.1.
 * Box art isn't fetched into Blob until this actually runs; see
 * `saveKitCandidate`'s own comment. */
export function KitCandidateCard({ candidate }: { candidate: KitCandidate }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await saveKitCandidate(candidate);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.card}>
      <KitCardBody
        imageUrl={candidate.imageUrl}
        brand={candidate.brand}
        name={candidate.name}
        kitNumber={candidate.kitNumber}
        scale={candidate.scale}
        category={candidate.category}
      />
      <div className={styles.cardActions}>
        {saved ? (
          <span className={styles.savedLabel}>
            <CheckIcon size={12} /> Saved
          </span>
        ) : (
          <button type="button" className={styles.saveButton} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save to wishlist"}
          </button>
        )}
      </div>
      {error ? <div className={styles.cardError}>{error}</div> : null}
    </div>
  );
}
