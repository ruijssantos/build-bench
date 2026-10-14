import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { nextStashStatus, previousStashStatus, statusAfterDateEdit, type KitDates } from "@/domain/kit";

describe("the status ladder", () => {
  test("forward and back are mirror images, ending at built and at stash", () => {
    assert.equal(nextStashStatus("stash"), "building");
    assert.equal(nextStashStatus("building"), "built");
    assert.equal(nextStashStatus("built"), null);
    assert.equal(previousStashStatus("built"), "building");
    assert.equal(previousStashStatus("building"), "stash");
    assert.equal(previousStashStatus("stash"), null);
  });
});

describe("statusAfterDateEdit", () => {
  const none: KitDates = { startedAt: null, completedAt: null };
  const started: KitDates = { startedAt: "2026-05-01", completedAt: null };
  const done: KitDates = { startedAt: "2026-05-01", completedAt: "2026-06-18" };

  test("setting Completed makes it Built, from anywhere", () => {
    assert.equal(statusAfterDateEdit("stash", none, { startedAt: null, completedAt: "2026-06-18" }), "built");
    assert.equal(statusAfterDateEdit("building", started, done), "built");
  });

  test("clearing Completed steps back to Building, or to Stash with no start", () => {
    assert.equal(statusAfterDateEdit("built", done, started), "building");
    assert.equal(statusAfterDateEdit("built", { startedAt: null, completedAt: "2026-06-18" }, none), "stash");
  });

  test("setting Started on a stashed kit puts it on the bench; clearing it takes it off", () => {
    assert.equal(statusAfterDateEdit("stash", none, started), "building");
    assert.equal(statusAfterDateEdit("building", started, none), "stash");
  });

  test("an edit that leaves the dates alone moves nothing", () => {
    // A kit that reached Building before dates were stamped has no start date;
    // saving its purchase details alone mustn't send it back to the shelf.
    assert.equal(statusAfterDateEdit("building", none, none), "building");
    assert.equal(statusAfterDateEdit("built", none, none), "built");
  });
});
