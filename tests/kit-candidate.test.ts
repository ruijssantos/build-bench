import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { MAX_CANDIDATES, normalizeCandidates } from "@/domain/kit-candidate";

const candidate = (over: Record<string, unknown> = {}) => ({
  brand: "Tamiya",
  kitNumber: "24072",
  name: "Toyota Tom's 84C",
  scale: "1:24",
  category: "cars",
  scalematesUrl: "https://www.scalemates.com/kits/1",
  imageUrl: "https://cdn.example.com/box.jpg",
  ...over,
});
const run = (candidates: ReturnType<typeof candidate>[]) =>
  normalizeCandidates({ candidates } as Parameters<typeof normalizeCandidates>[0]);

describe("normalizeCandidates", () => {
  test("a clean candidate passes through", () => {
    const [kit] = run([candidate()]);
    assert.equal(kit?.name, "Toyota Tom's 84C");
    assert.equal(kit?.category, "cars");
  });

  test("no brand or no name is no card", () => {
    assert.equal(run([candidate({ brand: "  " }), candidate({ name: "" })]).length, 0);
  });

  test("a link that isn't an absolute http(s) URL becomes no link, not a broken one", () => {
    const [kit] = run([candidate({ scalematesUrl: "the Scalemates page", imageUrl: "box.jpg" })]);
    assert.equal(kit?.scalematesUrl, null);
    assert.equal(kit?.imageUrl, null);
    assert.equal(run([candidate({ imageUrl: "javascript:alert(1)" })])[0]?.imageUrl, null);
  });

  test("an unknown category files as other", () => {
    assert.equal(run([candidate({ category: "spaceship" })])[0]?.category, "other");
  });

  test("the list is capped", () => {
    assert.equal(run(Array.from({ length: 15 }, () => candidate())).length, MAX_CANDIDATES);
  });
});
