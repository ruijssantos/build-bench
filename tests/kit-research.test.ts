import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { difficultyRating, normalizeResearch, sourceHost, type RawKitResearch } from "@/domain/kit-research";

const src = "https://forum.example.com/t/1";
const raw = (over: Partial<RawKitResearch>): RawKitResearch => ({
  difficulty: null,
  difficultyNote: null,
  fitIssues: [],
  tips: [],
  ...over,
});

describe("normalizeResearch", () => {
  test("a claim with no usable public source doesn't ship (§5.4)", () => {
    const research = normalizeResearch(
      raw({
        fitIssues: [
          { issue: "Bonnet sits proud", severity: "major", sourceUrl: src, confidence: 0.9 },
          { issue: "Unsourced", severity: "major", sourceUrl: "the forum", confidence: 0.9 },
          { issue: "Local file", severity: "major", sourceUrl: "file:///etc/passwd", confidence: 0.9 },
          { issue: "   ", severity: "major", sourceUrl: src, confidence: 0.9 },
        ],
      }),
    );
    assert.deepEqual(research.fitIssues.map((i) => i.issue), ["Bonnet sits proud"]);
  });

  test("an off-vocabulary word costs a label, not the run", () => {
    const research = normalizeResearch(
      raw({
        fitIssues: [
          { issue: "a", severity: "Medium", sourceUrl: src, confidence: 0.5 },
          { issue: "b", severity: "severe", sourceUrl: src, confidence: 0.5 },
          { issue: "c", severity: "whatever", sourceUrl: src, confidence: 0.5 },
        ],
        tips: [{ tip: "t", category: "Painting stuff", sourceUrl: src, confidence: 0.5 }],
      }),
    );
    assert.deepEqual(research.fitIssues.map((i) => [i.issue, i.severity]), [["b", "major"], ["a", "moderate"], ["c", "moderate"]]);
    assert.equal(research.tips[0]?.category, "reference");
  });

  test("issues rank by severity then confidence; the caps trim the weakest", () => {
    const issues = Array.from({ length: 8 }, (_, i) => ({ issue: `i${i}`, severity: "minor", sourceUrl: src, confidence: i / 10 }));
    const research = normalizeResearch(raw({ fitIssues: [...issues, { issue: "big", severity: "major", sourceUrl: src, confidence: 0.1 }] }));
    assert.equal(research.fitIssues.length, 5);
    assert.equal(research.fitIssues[0]?.issue, "big");
    assert.equal(research.fitIssues[1]?.issue, "i7");

    const tips = Array.from({ length: 9 }, (_, i) => ({ tip: `t${i}`, category: "paint", sourceUrl: src, confidence: i / 10 }));
    assert.deepEqual(normalizeResearch(raw({ tips })).tips.map((t) => t.tip), ["t8", "t7", "t6", "t5", "t4", "t3"]);
  });

  test("confidence is clamped to 0–1", () => {
    const [issue] = normalizeResearch(raw({ fitIssues: [{ issue: "x", severity: "minor", sourceUrl: src, confidence: 7 }] })).fitIssues;
    assert.equal(issue?.confidence, 1);
  });

  test("difficulty only from the vocabulary, case-insensitively", () => {
    assert.equal(normalizeResearch(raw({ difficulty: " Advanced " })).difficulty, "advanced");
    assert.equal(normalizeResearch(raw({ difficulty: "hard-ish" })).difficulty, null);
  });
});

describe("difficultyRating", () => {
  test("shown only when at least one source backs it", () => {
    assert.equal(difficultyRating("intermediate", 1), "Intermediate");
    assert.equal(difficultyRating("intermediate", 0), null);
    assert.equal(difficultyRating(null, 3), null);
  });
});

describe("sourceHost", () => {
  test("the host is the label beside a claim", () => {
    assert.equal(sourceHost("https://www.scalemates.com/kits/123"), "scalemates.com");
    assert.equal(sourceHost("not a url"), "source");
  });
});
