import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMaintenanceTypeSnapshot,
  calculateMaintenanceStatus,
  calculateNextDueCount,
  getMostUrgentMaintenanceStatus,
  recalculateDueCounts,
  validateWholeNonNegativeCount,
} from "./calculations";
import { getDefaultIntervalForModel } from "./intervals";
import type { PrinterMaintenanceProfile } from "./types";

function baseProfile(
  overrides: Partial<PrinterMaintenanceProfile> = {},
): PrinterMaintenanceProfile {
  return {
    printerId: "MX-TEST-001",
    assetTag: "MX-TEST-001",
    nickname: "Test",
    printerModel: "GD9630",
    customerName: "SFX",
    siteName: "Lab",
    currentCopyCount: 500_000,
    previousCopyCount: 400_000,
    monthlyVolume: 100_000,
    lastPMDate: "2026-01-01",
    lastCleaningDate: null,
    lastJointUnitDate: null,
    lastDTFPMDate: null,
    nextPMDue: null,
    nextCleaningDue: null,
    nextJointUnitDue: null,
    nextDTFDue: null,
    lastPMCopyCount: 0,
    lastCleaningCopyCount: null,
    lastJointUnitCopyCount: null,
    lastDTFPMCopyCount: null,
    nextPMDueCount: 1_000_000,
    nextCleaningDueCount: null,
    nextJointUnitDueCount: null,
    nextDTFDueCount: null,
    ...overrides,
  };
}

describe("calculateNextDueCount", () => {
  it("adds interval to last completed count", () => {
    assert.equal(calculateNextDueCount(200_000, 1_000_000), 1_200_000);
  });

  it("returns null when baseline is missing", () => {
    assert.equal(calculateNextDueCount(null, 1_000_000), null);
  });
});

describe("calculateMaintenanceStatus", () => {
  const warn = 100_000;

  it("returns UNKNOWN when data is missing", () => {
    assert.equal(
      calculateMaintenanceStatus(null, 1_000_000, warn).status,
      "UNKNOWN",
    );
    assert.equal(
      calculateMaintenanceStatus(500_000, null, warn).status,
      "UNKNOWN",
    );
  });

  it("returns CURRENT when below warning threshold", () => {
    const result = calculateMaintenanceStatus(500_000, 1_000_000, warn);
    assert.equal(result.status, "CURRENT");
    assert.equal(result.copiesRemaining, 500_000);
    assert.equal(result.copiesOverdue, 0);
  });

  it("returns DUE_SOON within warning threshold", () => {
    const result = calculateMaintenanceStatus(950_000, 1_000_000, warn);
    assert.equal(result.status, "DUE_SOON");
    assert.equal(result.copiesRemaining, 50_000);
  });

  it("returns DUE when count equals due count", () => {
    const result = calculateMaintenanceStatus(1_000_000, 1_000_000, warn);
    assert.equal(result.status, "DUE");
    assert.equal(result.copiesRemaining, 0);
  });

  it("returns OVERDUE when past due and never negative remaining", () => {
    const result = calculateMaintenanceStatus(1_050_000, 1_000_000, warn);
    assert.equal(result.status, "OVERDUE");
    assert.equal(result.copiesRemaining, 0);
    assert.equal(result.copiesOverdue, 50_000);
  });
});

describe("recalculateDueCounts and completion", () => {
  it("recalculates after maintenance completion baseline", () => {
    const intervals = getDefaultIntervalForModel("GD9630");
    const profile = baseProfile({
      lastPMCopyCount: 250_000,
      lastCleaningCopyCount: 100_000,
    });
    const next = recalculateDueCounts(profile, intervals);
    assert.equal(next.nextPMDueCount, 1_250_000);
    assert.equal(next.nextCleaningDueCount, 350_000);
  });
});

describe("model-specific intervals", () => {
  it("uses different intervals for GL9730 vs GD9630", () => {
    const gd = getDefaultIntervalForModel("GD9630");
    const gl = getDefaultIntervalForModel("GL9730");
    assert.notEqual(gd.pmInterval, gl.pmInterval);
    assert.equal(calculateNextDueCount(0, gl.pmInterval), 800_000);
  });
});

describe("setup required / most urgent", () => {
  it("marks missing baseline as UNKNOWN / Setup Required", () => {
    const profile = baseProfile({
      lastPMCopyCount: null,
      nextPMDueCount: null,
      lastCleaningCopyCount: null,
      nextCleaningDueCount: null,
      lastJointUnitCopyCount: null,
      nextJointUnitDueCount: null,
      lastDTFPMCopyCount: null,
      nextDTFDueCount: null,
    });
    const snap = buildMaintenanceTypeSnapshot(profile, "PM");
    assert.equal(snap.status, "UNKNOWN");
    assert.equal(snap.statusDisplay, "Setup Required");
  });

  it("prioritizes OVERDUE over DUE_SOON", () => {
    const profile = baseProfile({
      currentCopyCount: 1_300_000,
      lastPMCopyCount: 0,
      nextPMDueCount: 1_000_000,
      lastCleaningCopyCount: 1_200_000,
      nextCleaningDueCount: 1_450_000,
    });
    assert.equal(getMostUrgentMaintenanceStatus(profile), "OVERDUE");
  });
});

describe("lower copy count validation", () => {
  it("rejects non-whole numbers", () => {
    const result = validateWholeNonNegativeCount(12.5);
    assert.equal(result.ok, false);
  });

  it("accepts zero", () => {
    const result = validateWholeNonNegativeCount(0);
    assert.equal(result.ok, true);
  });
});
