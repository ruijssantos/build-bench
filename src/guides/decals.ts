import type { Guide } from "./types";

/**
 * Adapted from "Decal Manual — 1:24" (Oct 2026), rewritten for the bench's
 * own setting products: Tamiya Decal Adhesive takes the "set" role (grip and
 * slide time under the decal) and Mark Fit Strong the "sol" role (softening it
 * into detail). Cure times follow the body painting guide, since decals sit
 * between its two clear coats.
 */
export const DECALS_GUIDE: Guide = {
  slug: "decals",
  title: "Decal manual",
  topic: "Decals · 1:24",
  specs: ["Tamiya Decal Adhesive", "Mark Fit Strong"],
  summary:
    "Waterslide decals that look painted on: gloss under, adhesive to place, Mark Fit Strong to conform, clear over. They go on between gloss clear #1 and the final clear of the body painting manual.",
  sections: [
    {
      id: "core-principles",
      title: "Core principles",
      goal: "A decal disappears when it sits on gloss, is softened into every detail, and is buried under clear.",
      blocks: [
        {
          kind: "bullets",
          items: [
            {
              lead: "Gloss under.",
              text: "Satin or matte paint traps air under the carrier film and causes silvering. Always decal on a cured gloss coat.",
            },
            {
              lead: "Adhesive positions, Mark Fit conforms.",
              text: "Water and Decal Adhesive let the decal slide and then hold it. Mark Fit Strong softens it into panel lines and over curves. Each does one job.",
            },
            {
              lead: "Hands off while it's soft.",
              text: "A decal wrinkles as Mark Fit Strong works. Touching it then tears it. It flattens on its own as it dries.",
            },
            {
              lead: "Thin coats, more of them.",
              text: "Mark Fit Strong is the strong grade. Several thin coats with drying time between work better than one flood, which can melt fine print or wrinkle it for good.",
            },
            {
              lead: "Seal over.",
              text: "Enough clear on top that the edges can't be felt, so they vanish when you sand and polish.",
            },
          ],
        },
      ],
    },
    {
      id: "materials",
      title: "Tools & materials",
      blocks: [
        {
          kind: "table",
          columns: ["Item", "Used for"],
          rows: [
            ["Hobby knife with a fresh blade + cutting mat", "Trimming decals; slicing along panel lines"],
            ["Fine pointed tweezers", "Handling the backing paper, never the decal itself"],
            ["Shallow dish of lukewarm water", "Soaking"],
            ["Two soft flat brushes", "One for water and adhesive, one kept only for Mark Fit Strong"],
            ["Cotton buds + paper towel", "Rolling out water and blotting"],
            ["Tamiya Decal Adhesive", "A thin film under the decal: slide time, then grip"],
            ["Tamiya Mark Fit Strong", "Softening the decal into detail and curves"],
            ["Sewing needle or fine pin", "Pricking air bubbles and silvering"],
            ["Tamiya masking tape", "Marking alignment reference points"],
            ["Decal instruction sheet (photo or scan)", "Placement reference, kept dry and away from the bench"],
          ],
        },
        {
          kind: "note",
          title: "Why two brushes",
          text: "Mark Fit Strong left in a brush that then goes back into the water dish turns the water into a weak softener, and the next decal starts softening before it's placed. Rinse the Mark Fit brush in clean water after each use.",
        },
      ],
    },
    {
      id: "prep",
      eyebrow: "Stage 1",
      title: "Prep",
      goal: "A clean, hard gloss surface and a plan.",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              lead: "Let the gloss coat dry for 48 hours (X-22).",
              text: "Acrylic clear is dry to the touch long before it's hard, and Mark Fit Strong will soften or wrinkle clear that isn't. Lacquer clear needs only 24 hours.",
            },
            "Wipe the body with a lint-free cloth to remove dust and fingerprints.",
            "Photograph or scan the decal sheet and the placement guide. You'll want a reference once decals are cut out.",
            {
              lead: "Plan the order:",
              text: "",
              sub: [
                "Large base decals first (stripes, big livery panels).",
                "Then the decals that overlap them (numbers, sponsors).",
                "Small markings last.",
                "Work one side of the car at a time, so you're never resting the body on wet decals.",
              ],
            },
            {
              lead: "Test first.",
              text: "Put one spare decal through the full sequence, Mark Fit Strong included, on the underside of the body or a painted spoon. It shows how this sheet reacts before it matters.",
            },
          ],
        },
      ],
    },
    {
      id: "cut",
      eyebrow: "Stage 2",
      title: "Cut",
      blocks: [
        {
          kind: "steps",
          items: [
            "Cut each decal out individually, just before you use it.",
            "Trim as close to the printed edge as you can, about 0.5 mm or less. Less carrier film means less chance of silvering and a less visible edge.",
            "Cut through both the film and the backing paper with a fresh blade, using light, repeated strokes rather than one hard one.",
            "Keep text and logos joined by film as one piece unless the instructions show them separate.",
          ],
        },
      ],
    },
    {
      id: "soak",
      eyebrow: "Stage 3",
      title: "Soak",
      blocks: [
        {
          kind: "steps",
          items: [
            "Dip the decal in lukewarm water for 10–20 seconds. Bigger and thicker decals need the longer end.",
            "Take it out and lay it on a paper towel. Don't leave it floating in the water, because that washes off the decal's own glue.",
            "Wait until it slides freely on the backing, usually 30–60 seconds. Test by nudging it gently with a wet brush.",
          ],
        },
      ],
    },
    {
      id: "place",
      eyebrow: "Stage 4",
      title: "Place",
      goal: "Decal Adhesive under, decal on, water and air out.",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              lead: "Brush a thin film of Decal Adhesive",
              text: "onto the spot where the decal will go, just slightly larger than the decal. Thin is the point: what's left round the edges dries as a shiny or cloudy halo.",
              sub: [
                "For big livery decals, thin it with a little water, about 1:1, so the decal stays mobile longer.",
                "Small decals on flat gloss from a fresh sheet stick fine with water alone. Keep the adhesive for big decals, curves, panel lines and old sheets.",
              ],
            },
            "Hold the backing paper against the body right at the target spot.",
            "Slide the decal off the paper onto the model with a wet brush, pulling the paper away rather than pushing the decal.",
            {
              lead: "Position it with the wet brush.",
              text: "If it grabs, add a drop of water underneath to float it again. Decal Adhesive starts to hold within a few minutes, so get the position right first, then move on.",
            },
            "Once it's in place, roll a damp cotton bud from the centre outward to push water, adhesive and air out.",
            {
              lead: "Clean the edges straight away.",
              text: "Blot with a paper towel corner, then wipe any adhesive squeezed out round the decal with a damp cotton bud while it's still wet. Don't wipe across the decal itself.",
            },
            "Let it sit for 10–15 minutes before Mark Fit Strong, so the adhesive grips and the decal can't drift as it softens.",
          ],
        },
      ],
    },
    {
      id: "conform",
      eyebrow: "Stage 5",
      title: "Conform",
      goal: "Mark Fit Strong, in thin coats, until it looks painted on.",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              lead: "Brush on one thin coat of Mark Fit Strong.",
              text: "Load the brush lightly and lay it on in one or two strokes. Don't scrub, and don't go back over an area that's already wet.",
            },
            {
              lead: "Leave it alone.",
              text: "It will wrinkle and look ruined. That's the softener working, and it will flatten as it dries. Touching it now is how decals tear.",
            },
            "Let it dry fully, about 30 minutes, longer on thick decals.",
            "If it hasn't settled into panel lines or over curves, apply another thin coat. Repeat until it looks painted on, usually 2–3 coats.",
            "On very stubborn compound curves, lay a warm damp cloth over it briefly after a coat, then leave it to dry.",
          ],
        },
        {
          kind: "note",
          title: "When Mark Fit Strong is too much",
          text: "Very thin decals (many Tamiya sheets), fine text and tiny markings on flat panels barely need softening. One light coat, or none, is enough. If the spare in Stage 1 crazed or melted, cut Mark Fit Strong about 1:1 with water for the whole sheet.",
        },
      ],
    },
    {
      id: "dry-clean",
      eyebrow: "Stage 6",
      title: "Dry & clean",
      blocks: [
        {
          kind: "steps",
          items: [
            "Let all decals dry for at least 24 hours.",
            {
              lead: "Wash off residue.",
              text: "Wipe the whole body gently with a cloth dampened in lukewarm water to remove leftover Decal Adhesive and Mark Fit. Residue left under clear shows as cloudy marks or a halo round each decal.",
            },
            {
              lead: "Inspect under raking light:",
              text: "",
              sub: [
                "Silvering: prick the area with a needle, apply Mark Fit Strong, let it dry.",
                "Bubbles: prick, press down with a damp cotton bud, apply Mark Fit Strong.",
                "Lifted edges: a touch of Decal Adhesive under the edge with a fine brush, press down with a damp cotton bud, wipe off the excess, let it dry.",
              ],
            },
            "After any fix, wait another 24 hours and wash that spot again.",
          ],
        },
      ],
    },
    {
      id: "seal",
      eyebrow: "Stage 7",
      title: "Seal",
      goal: "This is Stage 5 of the body painting manual: the final clear.",
      blocks: [
        {
          kind: "steps",
          items: [
            "One light mist coat first, so wet clear doesn't hit bare decals. Let it flash for 10–15 minutes.",
            "Then 2–3 wet coats.",
            "Run a fingertip over the decal edges once the clear has dried. If you can feel a ridge, add another clear coat. Don't sand it flat.",
            "Cure for 1–2 weeks (X-22) or 5–7 days (lacquer), then sand and polish as in the body painting manual.",
          ],
        },
      ],
    },
    {
      id: "special-cases",
      title: "Special cases",
      blocks: [
        {
          kind: "note",
          title: "Large livery decals (rally and race cars)",
          items: [
            "Pick one reference point, such as a door edge or a panel line, and mark it with a small piece of masking tape.",
            "Use Decal Adhesive thinned with water underneath, plus a little extra water, so the decal stays mobile longer.",
            "Align the reference point first, then smooth outward from there.",
            "If a decal crosses several panels or wraps a complex shape, cut it into sections along a panel line before soaking. Joins at panel lines are invisible.",
          ],
        },
        {
          kind: "note",
          title: "Panel lines, door shuts and openings",
          items: [
            "Apply the decal straight over the panel line or opening and let the first coat of Mark Fit Strong soften it.",
            "Once it has dried, run a fresh blade along the panel line to slice the film.",
            "Apply another coat of Mark Fit Strong so the cut edges sink into the line. The Decal Adhesive underneath keeps the cut edges from lifting.",
            "For openings (wheel arches, vents, light holes), cut the film out from the inside after drying, then touch the edges with Mark Fit Strong.",
          ],
        },
        {
          kind: "note",
          title: "White or light decals on dark colours",
          text: "Thin white decals can look grey or let the colour show through. Test on a spare first. If it's too transparent, either paint and mask that area white first, or stack two copies of the decal if the sheet has spares, letting the first dry fully before the second.",
        },
        {
          kind: "note",
          title: "Old decal sheets",
          items: [
            { lead: "Yellowed carrier film:", text: "tape the sheet to a sunny window for a few days to bleach it." },
            {
              lead: "Cracking when soaked:",
              text: "the sheet needs a new film layer. Brush a coat of liquid decal film over the whole sheet, let it dry, then cut and use as normal.",
            },
            {
              lead: "Won't stick:",
              text: "old decal glue is often dead. Decal Adhesive under every decal is what this sheet needs, and it's where the adhesive earns its place.",
            },
            "Go easy with Mark Fit Strong on old film. It's brittle and can split. Thin it with water.",
            "Always test a spare first.",
          ],
        },
        {
          kind: "note",
          title: "Small and interior parts",
          text: "Decals on matte parts such as dashboards and seat belts still need gloss under them. Brush a small spot of Tamiya X-22 Clear where the decal goes, apply the decal, then bring the area back to matte with clear mixed with X-21 Flat Base.",
        },
      ],
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
      blocks: [
        {
          kind: "table",
          columns: ["Problem", "Likely cause", "Fix"],
          rows: [
            [
              "Silvering around the decal",
              "Applied on satin or matte; air under the film",
              "Prick, apply Mark Fit Strong; next time, gloss first",
            ],
            [
              "Decal won't slide off the paper",
              "Not soaked long enough",
              "Back in the water for a few seconds; wait longer on the towel",
            ],
            [
              "Decal sticks before it's positioned",
              "Not enough liquid under it, or the adhesive has started to grab",
              "Add water under the edge to float it; thin the adhesive next time",
            ],
            ["Decal folds over on itself", "Moved while dry, or too little water", "Flood with water and gently unroll with a wet brush"],
            [
              "Wrinkles that don't flatten",
              "Touched while soft, or Mark Fit Strong too heavy",
              "Let it dry fully; apply one thin coat",
            ],
            [
              "Decal tears or the print crazes",
              "Moved after Mark Fit was applied, or too strong for this sheet",
              "Patch with a spare or touch up with paint; thin Mark Fit with water",
            ],
            [
              "Decal drifts while softening",
              "Mark Fit applied before the adhesive grabbed",
              "Float it back with water; wait 10–15 minutes before Mark Fit",
            ],
            [
              "Doesn't sink into panel lines",
              "Too few Mark Fit coats",
              "Slice along the line with a fresh blade; another thin coat",
            ],
            [
              "Shiny or cloudy halo around the decal",
              "Decal Adhesive left on the paint round the edges",
              "Wipe with a damp bud before it dries; wash in Stage 6",
            ],
            [
              "Cloudy marks under clear",
              "Adhesive or Mark Fit residue",
              "Prevent by washing in Stage 6; once under clear, sand back and re-clear",
            ],
            ["Paint or clear wrinkles under the decal", "Gloss coat not cured", "Wait the full 48 hours for X-22 before decalling"],
            ["Decal edge visible after polishing", "Not enough clear over it", "Add clear, cure, sand and polish again"],
          ],
        },
      ],
    },
  ],
};
