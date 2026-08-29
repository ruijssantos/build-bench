"use client";

import { useState } from "react";

import { promoteKitToStash, saveKitCandidate } from "@/app/(bench)/kits/actions";
import { CheckIcon } from "@/components/icons";
import type { KitStatus } from "@/domain/kit";
import type { KitCandidate } from "@/domain/kit-candidate";

import { KitCardBody } from "./KitCardBody";
import styles from "./Wishlist.module.css";

/**
 * One search result, with the button that saves it — docs/PLAN.md §5.1,
 * shared by the Wishlist and the Stash (`status` picks which). Box art isn't
 * fetched into Blob until this actually runs; see `saveKitCandidate`'s own
 * comment.
 *
 * A duplicate found on another screen offers a Promote button instead of
 * just failing — but only saving into the stash offers it (`status !==
 * "wishlist"`): promoting a kit *out* of the stash on a save-to-wishlist
 * isn't a direction this app supports (§3.3 is one-directional), so the
 * wishlist screen shows the plain "already X" message and stops there.
 */
export function KitCandidateCard({ candidate, status }: { candidate: KitCandidate; status: KitStatus }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promote, setPromote] = useState<{ id: number; status: KitStatus } | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setPromote(null);
    try {
      const result = await saveKitCandidate(candidate, status);
      if (!result.ok) {
        setError(result.error);
        if (status !== "wishlist") setPromote(result.existing ?? null);
        return;
      }
      setSaved(true);
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function doPromote() {
    if (!promote) return;
    setSaving(true);
    try {
      const result = await promoteKitToStash(promote.id, promote.status);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setError(null);
      setPromote(null);
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
        ) : promote ? (
          <button type="button" className={styles.saveButton} onClick={() => void doPromote()} disabled={saving}>
            {saving ? "Promoting…" : "Promote to Stash"}
          </button>
        ) : (
          <button type="button" className={styles.saveButton} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : status === "wishlist" ? "Save to wishlist" : "Save to stash"}
          </button>
        )}
      </div>
      {error ? <div className={styles.cardError}>{error}</div> : null}
    </div>
  );
}
