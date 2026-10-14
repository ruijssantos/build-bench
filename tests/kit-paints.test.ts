import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { gunzeColour, nearestTamiyaPaints } from "@/catalogue/colour-match";
import { bucketPaintRequirements, codesToCheckOnShelf } from "@/domain/kit-paints";

const req = (paintCode: string | null, rawLabel: string | null = paintCode, dismissedAt: Date | null = null) => ({
  paintCode,
  rawLabel,
  dismissedAt,
});
const codes = (rows: { code: string }[]) => rows.map((r) => r.code);

describe("codesToCheckOnShelf", () => {
  test("adds the acrylic twin of an LP or TS, so owning X-1 covers LP-1", () => {
    assert.deepEqual(codesToCheckOnShelf(["LP-1", "TS-14", "XF-2"]).sort(), ["LP-1", "TS-14", "X-1", "XF-2"]);
  });
});

describe("bucketPaintRequirements", () => {
  test("owned, missing and covered-by-a-twin, each sorted in paint order", () => {
    const buckets = bucketPaintRequirements([req("XF-1"), req("X-2"), req("LP-1"), req("X-11")], new Set(["XF-1", "X-1"]));
    assert.deepEqual(codes(buckets.owned), ["XF-1"]);
    assert.deepEqual(codes(buckets.missing), ["X-2", "X-11"]);
    assert.deepEqual(codes(buckets.equivalents), ["LP-1"]);
    assert.equal(buckets.equivalents[0]?.substitute.code, "X-1");
  });

  test("a code called for on several parts is one chip", () => {
    const buckets = bucketPaintRequirements([req("X-2"), req("X-2"), req("X-2")], new Set());
    assert.equal(buckets.missing.length, 1);
  });

  test("an unresolved callout appears once, and not at all once dismissed", () => {
    const buckets = bucketPaintRequirements(
      [req(null, "Gunmetal (mix)"), req(null, "Gunmetal (mix)"), req(null, "Old note", new Date())],
      new Set(),
    );
    assert.deepEqual(buckets.unresolved.map((u) => u.rawLabel), ["Gunmetal (mix)"]);
  });

  test("an unresolved Mr. Color callout gets colour suggestions", () => {
    const [callout] = bucketPaintRequirements([req(null, "C68 モンザレッド RED MADDER")], new Set()).unresolved;
    assert.ok(callout && callout.closest.length > 0);
  });

  test("an uncatalogued code still renders, in the neutral fallback grey", () => {
    const [chip] = bucketPaintRequirements([req("XF-999")], new Set()).missing;
    assert.equal(chip?.name, "XF-999");
    assert.equal(chip?.hex, "#c7c9d1");
  });
});

describe("nearestTamiyaPaints", () => {
  test("never suggests a thinner, a flat base or a colourless clear", () => {
    // Mr. Color C8 Silver: these were three of its four "closest colours".
    const nonPaints = new Set(["X-20A", "LP-10", "X-21", "LP-22", "X-22", "PS-26", "TS-13"]);
    for (const code of ["C8", "H11", "C62", "H1"]) {
      const hex = gunzeColour(code);
      assert.ok(hex, code);
      for (const match of nearestTamiyaPaints(hex)) assert.ok(!nonPaints.has(match.code), `${code} → ${match.code}`);
    }
  });

  test("a tinted clear still matches its own colour", () => {
    const tinted = nearestTamiyaPaints("#c02028").flatMap((m) => [m.code, ...m.alsoAs]);
    assert.ok(tinted.includes("X-27"), tinted.join(", "));
  });

  test("silver finds silver", () => {
    const hex = gunzeColour("C8");
    assert.equal(nearestTamiyaPaints(hex!)[0]?.name, "Sparkling Silver");
  });
});
