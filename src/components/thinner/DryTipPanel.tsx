"use client";

import { useState } from "react";

import { ChevronDownIcon } from "@/components/icons";
import type { AirbrushRow } from "@/db/repositories/airbrush";

import styles from "./DryTipPanel.module.css";
import { shortRigLabel } from "./rig-label";

/**
 * The 74540's dry-tip/clogging guidance, ported from the prototype's
 * <details> phases — every rig fact (nozzle size, cup capacity, model name)
 * is interpolated from the `airbrush` row, never hard-coded (§2.3).
 */
function phasesFor(airbrush: AirbrushRow) {
  const nozzle = airbrush.nozzleMm != null ? `${airbrush.nozzleMm} mm` : "the needle";
  const cup = airbrush.cupCc != null ? `${airbrush.cupCc} cc` : "the";
  const model = airbrush.model ?? "this airbrush";

  return [
    {
      key: "before",
      title: "Before",
      items: [
        "Test-spray on scrap card first. If it spits a blob or stutters before it ever touches the model, the mix or the needle is off — fix it there.",
        `Trigger order matters on the ${model}: press straight down for air, then ease back for paint. Pulling back before the air is flowing dumps a wet blob right at the start of the pass.`,
        "Check the needle stopper — the small preset screw at the back that caps how far the trigger pulls. Wound in tight from last session's fine work, it starves a coverage pass and that starvation is what dries paint at the tip.",
        `Load the ${cup} cup half full at most. It's fixed to the body, not a swap-off jar, so there's no topping up mid-pass without breaking your rhythm — and a fuller cup skins across the surface faster with retarder in the mix.`,
      ],
    },
    {
      key: "during",
      title: "During",
      items: [
        "Wipe the needle tip with a barely damp cotton bud every few minutes on flats and metallics — before a crust forms, not after you notice it.",
        "Ragged edges or needing more trigger pull for the same coverage is tip dry starting. Stop and wipe rather than pushing more air through it.",
        `On a long metallic pass, back-flush every 30–40 seconds: cover the nozzle with a cloth-wrapped fingertip and pulse the trigger, pushing paint back into the cup instead of forward. Keeps flake from caking at the ${nozzle} tip.`,
        "Changing colour mid-session: this cup doesn't detach and swap like a bottle-feed gun. Flush with thinner and dry-fire a few times before the next fill, not just a quick rinse.",
      ],
    },
    {
      key: "after",
      title: "After",
      items: [
        "Flush with thinner until it sprays clear, then dry-fire air only for a few seconds to clear the passage.",
        "Wipe the integrated cup out with a cotton bud rather than just tipping it — retarder mixes leave a film in the corners a rinse alone won't shift.",
        "Back the needle stopper off before you put it down. A tight preset from tonight is a mystery starvation problem next session.",
        `Cap the nozzle or lay it tip-up. A knock on a bare ${nozzle} tip is the most common way a needle ends up bent.`,
      ],
    },
  ];
}

export function DryTipPanel({ airbrush }: { airbrush: AirbrushRow }) {
  const [open, setOpen] = useState(false);
  const phases = phasesFor(airbrush);

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.summary}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          <div className={styles.summaryText}>
            {shortRigLabel(airbrush.model ?? "Rig")} · dry tip &amp; clogging
          </div>
          <div className={styles.summaryHint}>Before / during / after</div>
        </span>
        <ChevronDownIcon size={18} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </button>

      {open ? (
        <div className={styles.phases}>
          {phases.map((phase) => (
            <div className={styles.phase} key={phase.key}>
              <div className={styles.phaseTitle}>{phase.title}</div>
              <div className={styles.list}>
                {phase.items.map((item) => (
                  <div className={styles.item} key={item}>
                    <span className={styles.dot} />
                    <span className={styles.text}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
