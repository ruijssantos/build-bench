import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { foreignCodeInLabel, normalizeExtractedPaints } from "@/domain/kit-paint-extraction";

describe("foreignCodeInLabel", () => {
  test("reads a Mr. Color / Mr. Hobby code at the head of the label", () => {
    assert.equal(foreignCodeInLabel("H4 イエロー YELLOW"), "H4");
    assert.equal(foreignCodeInLabel("C68 モンザレッド RED MADDER"), "C68");
  });

  test("only at the head, so a mixing ratio or part number is never read as a paint", () => {
    assert.equal(foreignCodeInLabel("Mix 1:1 C33"), null);
  });

  test("a Tamiya-shaped code is refused rather than matched against another brand", () => {
    assert.equal(foreignCodeInLabel("X-99 something"), null);
    assert.equal(foreignCodeInLabel("XF-1 Flat Black"), null);
  });
});

describe("normalizeExtractedPaints", () => {
  const run = (requirements: { rawLabel: string; codeGuess?: string | null }[]) =>
    normalizeExtractedPaints({ requirements } as Parameters<typeof normalizeExtractedPaints>[0]);

  test("a Tamiya code in the label resolves directly", () => {
    assert.deepEqual(run([{ rawLabel: "XF-1 Flat Black", codeGuess: null }]), [{ rawLabel: "XF-1 Flat Black", paintCode: "XF-1" }]);
  });

  test("a Mr. Color callout resolves through the cross-brand chart, guess or no guess", () => {
    assert.equal(run([{ rawLabel: "C33 つや消しブラック", codeGuess: null }])[0]?.paintCode, "XF-1");
    assert.equal(run([{ rawLabel: "flat black", codeGuess: "C33" }])[0]?.paintCode, "XF-1");
  });

  test("what can't be resolved is kept, with no code, to be looked up", () => {
    assert.deepEqual(run([{ rawLabel: "Gunmetal (mix)", codeGuess: null }]), [{ rawLabel: "Gunmetal (mix)", paintCode: null }]);
  });

  test("an empty label is dropped rather than stored as a row", () => {
    assert.deepEqual(run([{ rawLabel: "   ", codeGuess: "X-1" }]), []);
  });
});
