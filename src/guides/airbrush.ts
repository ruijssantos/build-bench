import { RIG } from "@/catalogue/rig";

import type { Guide } from "./types";

/**
 * The rig's own guide — dry tip and clogging, ported from the prototype's
 * <details> phases. Every rig fact (nozzle size, cup capacity, model name) is
 * interpolated from the compiled rig, never hard-coded (§2.3). This used to
 * be a modal off a "Current rig" block in the rail and phone header; the guide
 * page is now the one place the airbrush is described.
 */
function phases() {
  const nozzle = `${RIG.nozzleMm} mm`;
  const cup = `${RIG.cupCc} cc`;
  const model = RIG.model;

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

export const AIRBRUSH_GUIDE: Guide = {
  slug: "airbrush",
  title: RIG.model,
  topic: "Airbrush",
  specs: [`${RIG.nozzleMm} mm nozzle`, `${RIG.cupCc} cc cup`],
  summary: `Keeping the ${RIG.nozzleMm} mm tip from drying and clogging: what to check before a session, what to watch for during one, and how to put the airbrush away.`,
  sections: phases().map((phase) => ({
    id: phase.key,
    title: phase.title,
    blocks: [{ kind: "bullets", items: phase.items }],
  })),
};
