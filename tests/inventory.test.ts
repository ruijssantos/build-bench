import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { familyChipLabel, isRunningLow, paintSearchUrl, toggledLowState } from "@/domain/inventory";

describe("running low", () => {
  test("the toggle flips between low and in stock, nothing in between", () => {
    assert.equal(toggledLowState(null), "low");
    assert.equal(toggledLowState("low"), null);
    assert.equal(isRunningLow("low"), true);
    assert.equal(isRunningLow(null), false);
  });
});

describe("labels and links", () => {
  test("family pills are short, and an unknown family shows as itself", () => {
    assert.equal(familyChipLabel("sprayDecant"), "Spray");
    assert.equal(familyChipLabel(null), "Unfiled");
    assert.equal(familyChipLabel("mystery"), "mystery");
  });

  test("the shop link is a plain search for the paint", () => {
    assert.equal(paintSearchUrl("TS-8", "Italian Red"), "https://www.google.com/search?q=Tamiya%20TS-8%20Italian%20Red");
    assert.equal(paintSearchUrl("TS-8", null), "https://www.google.com/search?q=Tamiya%20TS-8");
  });
});
