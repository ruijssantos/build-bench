import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CATALOGUE } from "@/catalogue/paints";
import { buildPaintSearchIndex, searchPaintIndex, type SearchablePaint } from "@/domain/paint-search";

const paint = (code: string, name: string): SearchablePaint => ({ code, name, hex: null, family: "flat", finish: null });
const index = buildPaintSearchIndex([
  paint("X-19", "Smoke"),
  paint("X-2", "White"),
  paint("X-1", "Black"),
  paint("XF-1", "Flat Black"),
  paint("TS-14", "Black"),
  paint("XF-2", "Flat White"),
]);
const codes = (query: string, limit?: number) => searchPaintIndex(index, query, limit).map((p) => p.code);

describe("searchPaintIndex", () => {
  test("hyphens, spaces and case don't matter in a code", () => {
    for (const q of ["x1", "X 1", "x-1"]) assert.equal(codes(q)[0], "X-1");
  });

  test("an exact code beats a prefix, and X-2 sorts before X-19", () => {
    assert.deepEqual(codes("x1"), ["X-1", "X-19"]);
    assert.deepEqual(codes("x"), ["X-1", "X-2", "X-19", "XF-1", "XF-2"]);
  });

  test("a whole-name match outranks a name that only contains the word", () => {
    // Within a tier, lines sort alphabetically, so TS-14 leads X-1.
    assert.deepEqual(codes("black"), ["TS-14", "X-1", "XF-1"]);
  });

  test("a code match always outranks a name match", () => {
    const mixed = buildPaintSearchIndex([paint("X-1", "Black"), paint("XF-9", "Hull Red X1 tone")]);
    assert.deepEqual(searchPaintIndex(mixed, "x1").map((p) => p.code), ["X-1", "XF-9"]);
  });

  test("a blank query finds nothing, and the limit holds", () => {
    assert.deepEqual(codes("   "), []);
    assert.equal(codes("x", 2).length, 2);
  });

  test("against the real catalogue, a full code is the first hit", () => {
    const real = buildPaintSearchIndex(CATALOGUE);
    assert.equal(searchPaintIndex(real, "ts8")[0]?.code, "TS-8");
    assert.equal(searchPaintIndex(real, "italian red")[0]?.name, "Italian Red");
  });
});
