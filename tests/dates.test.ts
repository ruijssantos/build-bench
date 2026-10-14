import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { formatIsoDate, formatTimestampDate, readIsoDate } from "@/domain/dates";

describe("formatIsoDate", () => {
  test("formats from the ISO parts, so server and browser agree", () => {
    assert.equal(formatIsoDate("2026-06-18"), "18 Jun 2026");
    assert.equal(formatIsoDate("2026-01-05"), "5 Jan 2026");
  });

  test("passes through what it can't read, and keeps null as null", () => {
    assert.equal(formatIsoDate("someday"), "someday");
    assert.equal(formatIsoDate(null), null);
  });
});

describe("readIsoDate", () => {
  test("accepts a real date, trimmed", () => {
    assert.equal(readIsoDate(" 2026-06-18 "), "2026-06-18");
    assert.equal(readIsoDate("2028-02-29"), "2028-02-29");
  });

  test("rejects a day that doesn't exist, even though it has the right shape", () => {
    assert.equal(readIsoDate("2026-02-31"), null);
    assert.equal(readIsoDate("2026-02-29"), null);
    assert.equal(readIsoDate("2026-13-01"), null);
  });

  test("rejects anything that isn't a YYYY-MM-DD string", () => {
    for (const raw of ["", "18/06/2026", "2026-6-18", 20260618, null, undefined]) assert.equal(readIsoDate(raw), null);
  });
});

describe("formatTimestampDate", () => {
  test("reads a timestamp in UTC, so a late-evening upload is one day everywhere", () => {
    assert.equal(formatTimestampDate(new Date("2026-06-18T23:30:00Z")), "18 Jun 2026");
    assert.equal(formatTimestampDate(null), null);
  });
});
