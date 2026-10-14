import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  addUsage,
  formatCost,
  NO_USAGE,
  normalizeUpgrades,
  readUsage,
  runCostUsd,
  sourceHost,
  upgradeKindLabel,
  upgradesJobState,
  type RawKitUpgrades,
  type UpgradesJob,
} from "@/domain/kit-upgrades";

type RawUpgrade = RawKitUpgrades["upgrades"][number];
const part = (over: Partial<RawUpgrade>): RawUpgrade => ({
  maker: "Hobby Design",
  name: "Detail-up set",
  code: null,
  kind: "detail-up",
  adds: null,
  madeFor: "listed for NuNu PN24030",
  sourceUrls: ["https://www.spotmodel.com/p/1"],
  ...over,
});

describe("normalizeUpgrades", () => {
  test("only parts made for this kit, with a usable source, ship", () => {
    const upgrades = normalizeUpgrades({
      upgrades: [
        part({ name: "Kept" }),
        part({ name: "Generic seatbelts", madeFor: null }),
        part({ name: "Blank evidence", madeFor: "  " }),
        part({ name: "Unsourced", sourceUrls: ["the shop"] }),
        part({ name: "Local file", sourceUrls: ["file:///etc/passwd"] }),
        part({ name: "  " }),
      ],
    });
    assert.deepEqual(upgrades.map((u) => u.name), ["Kept"]);
  });

  test("ranked by distinct sites — one shop's three pages count once", () => {
    const upgrades = normalizeUpgrades({
      upgrades: [
        part({ name: "One shop, three pages", code: "A", sourceUrls: ["https://shop.example/1", "https://shop.example/2", "https://www.shop.example/3"] }),
        part({ name: "Two sites", code: "B", sourceUrls: ["https://a.example/x", "https://b.example/y"] }),
      ],
    });
    assert.deepEqual(upgrades.map((u) => [u.name, u.sourceUrls.length]), [["Two sites", 2], ["One shop, three pages", 1]]);
  });

  test("the same product twice merges its sources", () => {
    const upgrades = normalizeUpgrades({
      upgrades: [
        part({ code: "HD02-0423", sourceUrls: ["https://a.example/x"] }),
        part({ code: "HD02-0423", name: "Same thing, renamed", adds: "Etched grilles", sourceUrls: ["https://b.example/y"] }),
      ],
    });
    assert.equal(upgrades.length, 1);
    assert.deepEqual(upgrades[0]?.sourceUrls.map(sourceHost), ["a.example", "b.example"]);
    assert.equal(upgrades[0]?.adds, "Etched grilles");
  });

  test("an off-list kind costs a label, not the part", () => {
    const [pe, decals, odd] = normalizeUpgrades({
      upgrades: [part({ name: "a", kind: "PE" }), part({ name: "b", kind: "Decal sheet" }), part({ name: "c", kind: "gizmo" })],
    });
    assert.deepEqual([pe?.kind, decals?.kind, odd?.kind], ["photo-etch", "decals", "other"]);
    assert.equal(upgradeKindLabel(odd?.kind ?? ""), "Upgrade");
  });

  test("capped at a screenful", () => {
    const many = Array.from({ length: 20 }, (_, i) => part({ name: `p${i}`, code: `${i}` }));
    assert.equal(normalizeUpgrades({ upgrades: many }).length, 12);
  });
});

describe("run cost", () => {
  test("sums every call, cache and searches included", () => {
    const usage = addUsage(
      addUsage(NO_USAGE, {
        input_tokens: 10_000,
        output_tokens: 2_000,
        cache_creation_input_tokens: 4_000,
        cache_read_input_tokens: null,
        server_tool_use: { web_search_requests: 3, web_fetch_requests: 1 },
      }),
      { input_tokens: 5_000, output_tokens: 1_000, cache_creation_input_tokens: null, cache_read_input_tokens: 20_000, server_tool_use: null },
    );
    assert.deepEqual(usage, {
      inputTokens: 15_000,
      outputTokens: 3_000,
      cacheWriteTokens: 4_000,
      cacheReadTokens: 20_000,
      webSearches: 3,
      webFetches: 1,
    });
    // 15k×$2 + 3k×$10 + 4k×$2.50 + 20k×$0.20 per MTok = $0.074, + 3 searches × $0.01
    assert.equal(runCostUsd(usage).toFixed(3), "0.104");
    assert.equal(formatCost(runCostUsd(usage)), "$0.10");
    assert.equal(formatCost(0.004), "under $0.01");
  });

  test("a stored usage reads back loosely", () => {
    assert.deepEqual(readUsage({ inputTokens: 5, webSearches: "lots" }), { ...NO_USAGE, inputTokens: 5 });
    assert.deepEqual(readUsage(null), NO_USAGE);
  });
});

describe("upgradesJobState", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const job = (over: Partial<UpgradesJob>): UpgradesJob => ({
    id: "j",
    stage: "investigate",
    error: null,
    startedAt: new Date("2026-10-14T11:58:00Z"),
    updatedAt: new Date("2026-10-14T11:58:00Z"),
    hasWriteUp: false,
    ...over,
  });

  test("no job, or a finished one, is idle", () => {
    assert.deepEqual(upgradesJobState(undefined, now), { state: "idle" });
    assert.deepEqual(upgradesJobState(job({ stage: "done" }), now), { state: "idle" });
  });

  test("a recent stage is running", () => {
    assert.equal(upgradesJobState(job({}), now).state, "running");
  });

  test("a stage silent past the function's lifetime has failed", () => {
    const stalled = upgradesJobState(job({ stage: "extract", updatedAt: new Date("2026-10-14T11:50:00Z"), hasWriteUp: true }), now);
    assert.equal(stalled.state, "failed");
    assert.equal(stalled.state === "failed" && stalled.canResume, true);
  });

  test("a failure carries its reason", () => {
    assert.deepEqual(upgradesJobState(job({ stage: "failed", error: "Out of credit" }), now), {
      state: "failed",
      error: "Out of credit",
      canResume: false,
    });
  });
});
