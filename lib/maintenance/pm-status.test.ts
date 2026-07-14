import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCountsRemaining,
  calculateNextPmDueCount,
  calculatePmCleaningStatus,
  mapLegacyMaintenanceStatus,
  PM_STATUS_DISPLAY_LABELS,
  resolveDueSoonThreshold,
  toLegacyMaintenanceStatus,
  toPmStatusDisplayLabel,
} from "./pm-status";

describe("calculateNextPmDueCount", () => {
  it("adds interval to last PM count", () => {
    assert.equal(calculateNextPmDueCount(500_000, 1_000_000), 1_500_000);
  });

  it("returns null when last PM is missing", () => {
    assert.equal(calculateNextPmDueCount(null, 1_000_000), null);
    assert.equal(calculateNextPmDueCount(undefined, 1_000_000), null);
  });

  it("returns null when interval is missing or non-positive", () => {
    assert.equal(calculateNextPmDueCount(100, null), null);
    assert.equal(calculateNextPmDueCount(100, 0), null);
    assert.equal(calculateNextPmDueCount(100, -10), null);
  });

  it("floors fractional inputs", () => {
    assert.equal(calculateNextPmDueCount(10.9, 100.8), 110);
  });

  it("rejects negative last PM count", () => {
    assert.equal(calculateNextPmDueCount(-1, 1_000_000), null);
  });
});

describe("calculateCountsRemaining", () => {
  it("returns positive remaining", () => {
    assert.equal(calculateCountsRemaining(900_000, 1_000_000), 100_000);
  });

  it("clamps at zero when overdue", () => {
    assert.equal(calculateCountsRemaining(1_100_000, 1_000_000), 0);
  });

  it("returns null for missing inputs", () => {
    assert.equal(calculateCountsRemaining(null, 1_000_000), null);
    assert.equal(calculateCountsRemaining(500_000, null), null);
  });
});

describe("resolveDueSoonThreshold", () => {
  it("uses 10% of interval when explicit is omitted", () => {
    assert.equal(resolveDueSoonThreshold(1_000_000), 100_000);
    assert.equal(resolveDueSoonThreshold(15), 1);
  });

  it("uses explicit threshold when provided", () => {
    assert.equal(resolveDueSoonThreshold(1_000_000, 50_000), 50_000);
    assert.equal(resolveDueSoonThreshold(1_000_000, 0), 0);
  });

  it("ignores non-finite explicit and falls back", () => {
    assert.equal(resolveDueSoonThreshold(1_000_000, Number.NaN), 100_000);
  });
});

describe("calculatePmCleaningStatus", () => {
  it("returns NOT_CONFIGURED when interval is missing", () => {
    const result = calculatePmCleaningStatus({
      currentCount: 500_000,
      lastPmCount: 0,
      pmInterval: null,
    });
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.equal(result.displayLabel, "Not Configured");
    assert.equal(result.nextPmDueCount, null);
  });

  it("returns NOT_CONFIGURED when last PM baseline is missing", () => {
    const result = calculatePmCleaningStatus({
      currentCount: 500_000,
      lastPmCount: null,
      pmInterval: 1_000_000,
    });
    assert.equal(result.status, "NOT_CONFIGURED");
  });

  it("returns NOT_CONFIGURED when current meter is missing but still exposes next due", () => {
    const result = calculatePmCleaningStatus({
      currentCount: null,
      lastPmCount: 200_000,
      pmInterval: 1_000_000,
    });
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.equal(result.nextPmDueCount, 1_200_000);
    assert.equal(result.countsRemaining, null);
  });

  it("returns GOOD when remaining is above due-soon band", () => {
    const result = calculatePmCleaningStatus({
      currentCount: 500_000,
      lastPmCount: 0,
      pmInterval: 1_000_000,
      dueSoonThreshold: 100_000,
    });
    assert.equal(result.status, "GOOD");
    assert.equal(result.displayLabel, "Good");
    assert.equal(result.nextPmDueCount, 1_000_000);
    assert.equal(result.countsRemaining, 500_000);
    assert.equal(result.countsOverdue, 0);
  });

  it("uses 10% default due-soon threshold when not provided", () => {
    // interval 1_000_000 → threshold 100_000; remaining 80_000 → DUE_SOON
    const result = calculatePmCleaningStatus({
      currentCount: 920_000,
      lastPmCount: 0,
      pmInterval: 1_000_000,
    });
    assert.equal(result.status, "DUE_SOON");
    assert.equal(result.countsRemaining, 80_000);
  });

  it("returns DUE_SOON within explicit threshold", () => {
    const result = calculatePmCleaningStatus({
      currentCount: 960_000,
      lastPmCount: 0,
      pmInterval: 1_000_000,
      dueSoonThreshold: 50_000,
    });
    assert.equal(result.status, "DUE_SOON");
    assert.equal(result.displayLabel, "Due Soon");
  });

  it("returns DUE when current equals next due", () => {
    const result = calculatePmCleaningStatus({
      currentCount: 1_200_000,
      lastPmCount: 200_000,
      pmInterval: 1_000_000,
    });
    assert.equal(result.status, "DUE");
    assert.equal(result.countsRemaining, 0);
    assert.equal(result.countsOverdue, 0);
  });

  it("returns OVERDUE when past due", () => {
    const result = calculatePmCleaningStatus({
      currentCount: 1_250_000,
      lastPmCount: 200_000,
      pmInterval: 1_000_000,
    });
    assert.equal(result.status, "OVERDUE");
    assert.equal(result.displayLabel, "Overdue");
    assert.equal(result.countsRemaining, 0);
    assert.equal(result.countsOverdue, 50_000);
  });

  it("rejects zero interval as not configured", () => {
    const result = calculatePmCleaningStatus({
      currentCount: 10,
      lastPmCount: 0,
      pmInterval: 0,
    });
    assert.equal(result.status, "NOT_CONFIGURED");
  });

  it("rejects negative current as not configured", () => {
    const result = calculatePmCleaningStatus({
      currentCount: -5,
      lastPmCount: 0,
      pmInterval: 1_000_000,
    });
    assert.equal(result.status, "NOT_CONFIGURED");
  });
});

describe("legacy status mapping", () => {
  it("maps GOOD ↔ CURRENT and NOT_CONFIGURED ↔ UNKNOWN", () => {
    assert.equal(toLegacyMaintenanceStatus("GOOD"), "CURRENT");
    assert.equal(toLegacyMaintenanceStatus("NOT_CONFIGURED"), "UNKNOWN");
    assert.equal(mapLegacyMaintenanceStatus("CURRENT"), "GOOD");
    assert.equal(mapLegacyMaintenanceStatus("UNKNOWN"), "NOT_CONFIGURED");
  });

  it("passes through shared statuses", () => {
    assert.equal(toLegacyMaintenanceStatus("DUE_SOON"), "DUE_SOON");
    assert.equal(toLegacyMaintenanceStatus("DUE"), "DUE");
    assert.equal(toLegacyMaintenanceStatus("OVERDUE"), "OVERDUE");
  });

  it("exposes Patch 45 display labels", () => {
    assert.equal(toPmStatusDisplayLabel("GOOD"), "Good");
    assert.equal(PM_STATUS_DISPLAY_LABELS.NOT_CONFIGURED, "Not Configured");
  });
});
