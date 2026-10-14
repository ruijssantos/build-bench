import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { comparePaintCodes, familyFromLinePrefix, normalizePaintCode } from "@/domain/paint-code";

describe("normalizePaintCode", () => {
  test("every way a code gets typed lands on the catalogue's spelling", () => {
    for (const raw of ["xf64", "XF 64", "xf-64", " XF-64 ", "XF064"]) assert.equal(normalizePaintCode(raw), "XF-64");
  });

  test("a suffix letter survives", () => {
    assert.equal(normalizePaintCode("x20a"), "X-20A");
  });

  test("a chart's zero-padded code resolves (AS01 is AS-1)", () => {
    assert.equal(normalizePaintCode("AS01"), "AS-1");
  });

  test("anything else passes through uppercased", () => {
    assert.equal(normalizePaintCode("mr color"), "MRCOLOR");
  });
});

describe("comparePaintCodes", () => {
  test("line first (X, XF, LP, TS, AS, PS), then the number as a number", () => {
    const codes = ["PS-1", "X-19", "TS-8", "XF-1", "X-2", "AS-12", "LP-4", "ZZ-1", "X-2A"];
    assert.deepEqual([...codes].sort(comparePaintCodes), ["X-2", "X-2A", "X-19", "XF-1", "LP-4", "TS-8", "AS-12", "PS-1", "ZZ-1"]);
  });
});

describe("familyFromLinePrefix", () => {
  test("an uncatalogued code still gets a family from its line", () => {
    assert.equal(familyFromLinePrefix("X-999"), "gloss");
    assert.equal(familyFromLinePrefix("XF-999"), "flat");
    assert.equal(familyFromLinePrefix("LP-999"), "lacquer");
    assert.equal(familyFromLinePrefix("TS-999"), "sprayDecant");
    assert.equal(familyFromLinePrefix("PS-999"), "polycarb");
    assert.equal(familyFromLinePrefix("H-4"), null);
  });
});
