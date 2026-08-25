import rigSeed from "../../seed/rig.json";

/**
 * The airbrush every ratio, pressure and distance in this app is stated for —
 * docs/PLAN.md §2.3. Compiled into the build rather than queried, on the same
 * rule as the paint catalogue (`./paints.ts`, `PERFORMANCE.md` §2): it is
 * seeded from a committed file, has no UI that edits it, and changes only on
 * deploy.
 *
 * It used to be a Postgres row, which put a Neon round trip in the rail and
 * the phone header — components that render on *every* screen — to read three
 * fields that had never changed. The discipline it was protecting is unaffected
 * and still holds: rig facts are read from here, never hard-coded into copy.
 */

export interface Rig {
  model: string;
  nozzleMm: number;
  cupCc: number;
}

export const RIG: Rig = {
  model: rigSeed.model,
  nozzleMm: rigSeed.nozzle_mm,
  cupCc: rigSeed.cup_cc,
};
