import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { familyChipLabel, isRunningLow, toggledLowState } from "@/domain/inventory";

describe("running low", () => {
  test("the toggle flips between low and in stock, nothing in between", () => {
    assert.equal(toggledLowState(null), "low");
    assert.equal(toggledLowState("low"), null);
    assert.equal(isRunningLow("low"), true);
    assert.equal(isRunningLow(null), false);
  });
});

describe("labels", () => {
  test("family pills are short, and an unknown family shows as itself", () => {
    assert.equal(familyChipLabel("sprayDecant"), "Spray");
    assert.equal(familyChipLabel(null), "Unfiled");
    assert.equal(familyChipLabel("mystery"), "mystery");
  });
});
