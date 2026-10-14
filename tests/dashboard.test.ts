import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildShopRun, isReadyToBuild } from "@/domain/dashboard";

describe("isReadyToBuild", () => {
  const counts = { ownedCount: 0, equivalentCount: 0, missingCount: 0, unresolvedCount: 0 };

  test("nothing missing and something actually checked", () => {
    assert.equal(isReadyToBuild({ ...counts, ownedCount: 5 }), true);
    assert.equal(isReadyToBuild({ ...counts, equivalentCount: 2 }), true);
  });

  test("a kit with no paint list is unknown, not ready", () => {
    assert.equal(isReadyToBuild(counts), false);
    assert.equal(isReadyToBuild(undefined), false);
  });

  test("one missing paint means a shop run first", () => {
    assert.equal(isReadyToBuild({ ...counts, ownedCount: 9, missingCount: 1 }), false);
  });
});

describe("buildShopRun", () => {
  test("missing paints first, then low bottles, each in paint order", () => {
    const run = buildShopRun(
      [{ paintCode: "XF-1", kitCount: 1 }, { paintCode: "X-2", kitCount: 2 }],
      [{ paintCode: "TS-8", state: "low" }, { paintCode: "X-11", state: null }, { paintCode: "X-18", state: "low" }],
    );
    assert.deepEqual(run.map((e) => [e.code, e.reason]), [["X-2", "missing"], ["XF-1", "missing"], ["X-18", "low"], ["TS-8", "low"]]);
    assert.equal(run[0]?.kitCount, 2);
    assert.equal(run[0]?.name, "White");
  });

  test("a spray can and its decanted jar, both low, are one thing to buy", () => {
    const run = buildShopRun([], [{ paintCode: "TS-8", state: "low" }, { paintCode: "TS-8", state: "low" }]);
    assert.equal(run.length, 1);
  });

  test("a code the catalogue doesn't know still renders", () => {
    const [entry] = buildShopRun([{ paintCode: "XF-999", kitCount: 1 }], []);
    assert.equal(entry?.name, "XF-999");
    assert.equal(entry?.hex, "#c7c9d1");
  });
});
