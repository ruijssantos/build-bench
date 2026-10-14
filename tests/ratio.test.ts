import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { calculateCupFill, formatRatioNumber, resolveEffectiveRatio, type RatioRuleLike } from "@/domain/ratio";

const rule: RatioRuleLike = {
  family: "flat",
  thinnerType: "X-20A",
  paintParts: 1,
  thinnerParts: 1.5,
  windowLo: 1,
  windowHi: 2,
  psiText: "15–20 psi",
  coatsText: "2–3",
  distanceText: "10–15 cm",
  notes: null,
};

describe("resolveEffectiveRatio", () => {
  test("the family rule alone", () => {
    const ratio = resolveEffectiveRatio(rule);
    assert.equal(ratio?.paintParts, 1);
    assert.equal(ratio?.thinnerParts, 1.5);
    assert.deepEqual(ratio?.notes, []);
    assert.equal(ratio?.isOverridden, false);
    assert.equal(ratio?.overrideReason, null);
  });

  test("an override wins field by field, and falls back where it is silent", () => {
    const ratio = resolveEffectiveRatio(rule, { paintParts: 1, thinnerParts: 2, psiText: null, reason: "too thick" });
    assert.equal(ratio?.thinnerParts, 2);
    assert.equal(ratio?.psiText, "15–20 psi");
    assert.equal(ratio?.isOverridden, true);
    assert.equal(ratio?.overrideReason, "too thick");
  });

  test("a family with no ratio of its own has none", () => {
    assert.equal(resolveEffectiveRatio({ ...rule, family: "additive", paintParts: null, thinnerParts: null }), null);
  });
});

describe("formatRatioNumber", () => {
  test("drops trailing zeros the way the prototype did", () => {
    assert.equal(formatRatioNumber(1), "1");
    assert.equal(formatRatioNumber(1.5), "1.5");
    assert.equal(formatRatioNumber(1.25), "1.25");
    assert.equal(formatRatioNumber(2.004), "2");
  });
});

describe("calculateCupFill", () => {
  test("drops of paint to drops of thinner to ml to share of the cup", () => {
    const fill = calculateCupFill(20, { paintParts: 1, thinnerParts: 1.5 }, 7);
    assert.equal(fill.thinnerDrops, 30);
    assert.equal(fill.totalMl, 2.5);
    assert.equal(fill.totalMlText, "2.5");
    assert.ok(Math.abs(fill.pctOfCup - 35.714) < 0.01);
    assert.equal(fill.overCapacity, false);
  });

  test("thinner drops round to a whole drop", () => {
    assert.equal(calculateCupFill(5, { paintParts: 3, thinnerParts: 2 }, 7).thinnerDrops, 3);
  });

  test("flags a mix that overflows the cup", () => {
    assert.equal(calculateCupFill(100, { paintParts: 1, thinnerParts: 1 }, 7).overCapacity, true);
  });

  test("a cup of no size reads 0%, not Infinity", () => {
    assert.equal(calculateCupFill(20, { paintParts: 1, thinnerParts: 1 }, 0).pctOfCup, 0);
  });
});
