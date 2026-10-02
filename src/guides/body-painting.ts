import type { Guide } from "./types";

/**
 * Transcribed from "Body Painting Manual — 1:24" (Oct 2026). Wording is kept
 * as written; only the layout is this app's.
 */
export const BODY_PAINTING_GUIDE: Guide = {
  slug: "body-painting",
  title: "Body painting manual",
  topic: "Body · 1:24",
  summary:
    "Primer to mirror finish on a 1:24 car body: colour coats, gloss clear, decals, final clear, cure, then level and polish.",
  sections: [
    {
      id: "core-principles",
      title: "Core principles",
      goal: "The colour coat's only job is even, full coverage. The gloss comes from the clear and the polishing.",
      blocks: [
        {
          kind: "bullets",
          items: [
            {
              lead: "Colour coats are medium-wet, not misty.",
              text: "Each pass should land just wet enough to flow, giving an even satin sheen. Coats that land too dry leave a gritty texture, and clear won't level it out.",
            },
            {
              lead: "Paint the body first, not last.",
              text: "The final clear needs about a week to cure before polishing. Build the chassis, interior and engine while it cures.",
            },
            {
              lead: "Practise first.",
              text: "Run the full sequence on plastic spoons or a junk body before the real one.",
            },
          ],
        },
      ],
    },
    {
      id: "schedule",
      eyebrow: "Stage 0",
      title: "Schedule",
      blocks: [
        {
          kind: "steps",
          items: [
            "Prime and paint the body at the start of the build.",
            "Build the chassis, interior and engine while the body cures.",
          ],
        },
      ],
    },
    {
      id: "prep",
      eyebrow: "Stage 1",
      title: "Prep",
      goal: "After primer.",
      blocks: [
        {
          kind: "steps",
          items: [
            "Let the primer dry for 24 hours.",
            "Wet-sand lightly with the 3000 sponge, just enough to knock down dust and texture. Use 2000 only on real flaws.",
            "Wash with lukewarm water and a drop of dish soap, then let it dry fully.",
            "Wipe with a lint-free cloth just before spraying, and tack off any dust.",
          ],
        },
      ],
    },
    {
      id: "colour-coats",
      eyebrow: "Stage 2",
      title: "Colour coats",
      goal: "Goal: even satin, not gloss.",
      blocks: [
        {
          kind: "steps",
          items: [
            { lead: "Tack coat:", text: "one light, dry-ish pass over the whole body. Let it flash for 10 minutes." },
            {
              lead: "Build coats (2–3):",
              text: "medium-wet passes.",
              sub: [
                "Overlap each pass by 50%.",
                "Start and stop the spray off the body, never on it.",
                "Keep a constant speed. Pausing creates heavy spots.",
                "Do edges, door shuts and panel lines first, then the big flat panels.",
                "Let each coat flash for 10–15 minutes before the next.",
              ],
            },
            {
              lead: "Check under raking light.",
              text: "You want even colour, no primer showing and a uniform satin sheen. Stop there; extra coats only bury detail.",
            },
            "Let it cure for 24–48 hours.",
            {
              lead: "Nib-sand:",
              text: "knock off dust specks with the 3000 sponge, using very light pressure. Avoid edges and ridges.",
            },
          ],
        },
      ],
    },
    {
      id: "gloss-clear",
      eyebrow: "Stage 3",
      title: "Gloss clear #1",
      goal: "The decal base.",
      blocks: [
        {
          kind: "steps",
          items: [
            "Spray one light coat and let it flash.",
            "Spray one wet coat (technique in Stage 5).",
            "Let it dry for 24 hours.",
          ],
        },
        {
          kind: "note",
          title: "Why this coat matters",
          text: "It prevents silvering. A satin colour coat looks smooth but is full of microscopic peaks and valleys. A decal bridges across them and traps air, which shows as a frosted, silvery patch around the carrier film. On gloss, the decal sits flat and the film disappears. It also:",
          items: [
            "lets Micro Set and Micro Sol (or Mark Fit) pull decals evenly into panel lines and over curves;",
            "protects the colour from decal solvents and from dabbing with a cloth;",
            "makes mistakes recoverable, since you can lift a decal without damaging the colour;",
            "reveals dust, thin colour or texture before decals lock it in.",
          ],
        },
        {
          kind: "note",
          title: "When to skip it",
          text: "No decals on the body, or the colour already dried glossy (some decanted TS colours do). Check under raking light. If the colour is satin and decals are going on, don't skip it.",
        },
      ],
    },
    {
      id: "decals",
      eyebrow: "Stage 4",
      title: "Decals",
      blocks: [
        {
          kind: "steps",
          items: [
            "Apply decals with Micro Set and Micro Sol, or Mark Fit Strong on tight curves.",
            "Let them dry for 24 hours, then wipe off residue with a damp cloth.",
          ],
        },
      ],
    },
    {
      id: "final-clear",
      eyebrow: "Stage 5",
      title: "Final clear",
      goal: "The wet look. This is the stage that needs the wet-coat skill.",
      blocks: [
        {
          kind: "steps",
          items: [
            { lead: "Mist coat:", text: "one light pass to seal the decals before any wet coat hits them." },
            {
              lead: "Wet coats (2–3):",
              text: "",
              sub: [
                "Move closer (5–8 cm), raise pressure toward 20 PSI, and slow down.",
                "Watch the reflection of a light source in the surface. The moment it turns glossy, move on.",
                "One deliberate pass per panel. Don't go back to fix a wet spot; that's how runs start.",
                "Wait 15–20 minutes between coats.",
              ],
            },
            "A little orange peel is fine. You'll sand it out.",
            "If you can feel decal edges, add another clear coat rather than sanding them flat later.",
          ],
        },
      ],
    },
    {
      id: "cure",
      eyebrow: "Stage 6",
      title: "Cure",
      blocks: [
        {
          kind: "steps",
          items: [
            "Wait 5–7 days for lacquer clear. Polishing early makes the clear shrink and dull afterwards.",
            "Keep the body under a dust cover, such as an upturned plastic box.",
          ],
        },
      ],
    },
    {
      id: "level-polish",
      eyebrow: "Stage 7",
      title: "Level & polish",
      goal: "Where the mirror comes from.",
      blocks: [
        {
          kind: "paragraph",
          text: "The 1000/2000/3000 sponges plus the three Tamiya compounds are all you need. Each step only removes the previous step's scratches, and Compound Coarse is made to take out 2000–3000 scratches. Finer Micromesh grits just make compounding faster; use them only for extra insurance.",
        },
        {
          kind: "steps",
          items: [
            {
              lead: "Level:",
              text: "wet-sand the clear with the 3000 sponge.",
              sub: [
                "Light pressure, small circles, keep it wet.",
                "Barely touch sharp edges and body lines.",
                "Stop when the surface is uniformly dull. Small shiny dots are orange-peel low spots: sand a little more.",
              ],
            },
            {
              lead: "Polish:",
              text: "Tamiya Compound Coarse → Fine → Finish, with a fresh cloth for each grade. Buff until the haze clears.",
            },
            { lead: "Optional:", text: "a coat of modelling wax for extra depth." },
          ],
        },
      ],
    },
    {
      id: "grits",
      title: "Which grit where",
      blocks: [
        {
          kind: "table",
          columns: ["Grit", "Use it for", "On clear?"],
          rows: [
            ["1000", "Primer flaws, seam lines, runs in primer", "No — burns through fast"],
            ["2000", "Knocking down a run or heavy orange peel", "Only on that spot, then 3000"],
            ["3000", "Levelling final clear; nib-sanding colour", "Default starting grit"],
            ["Compound Coarse / Fine / Finish", "Removing 3000 scratches; bringing up shine", "Yes"],
          ],
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
              "Spotty, heavy in some areas",
              "Pausing or slowing on a panel; starting the spray on the body",
              "Constant speed; start and stop off the body",
            ],
            [
              "Grainy or sandy finish",
              "Too far away, too dry, or acrylic drying mid-air",
              "Get closer; use lacquer; add a little thinner",
            ],
            ["Runs", "Too close, too slow, or going back over a wet area", "One pass per panel, then leave it"],
            ["Spitting or uneven delivery", "Compressor pulsing at low pressure", "Keep it nearer 20 PSI for wet coats"],
            ["Silvering around decals", "Decals applied on satin colour", "Gloss clear before decals (Stage 3)"],
            ["Dull after polishing", "Clear not fully cured", "Wait the full week"],
            ["Colour showing through while sanding", "Sanded through the clear", "Stop; re-clear the panel; cure; re-polish"],
          ],
        },
      ],
    },
  ],
};
