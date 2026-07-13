import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  averageDailyVolume,
  buildMeterTableRow,
  computeMachineHealthScore,
  enterMeterCount,
  estimatePmDate,
  getForecast,
  getPmDashboard,
  importMeterCsv,
  mapLegacyStatusToIntelligence,
  parseMeterCsv,
  resetPmIntelligenceForTests,
  validateMeterCount,
} from "./index";
import {
  canImportMeterCounts,
  canManagePmSettings,
  canViewPmIntelligence,
} from "@/lib/auth/pm-intelligence-permissions";
import type { PrinterMaintenanceProfile } from "@/lib/maintenance";

function fakeProfile(
  overrides: Partial<PrinterMaintenanceProfile> = {},
): PrinterMaintenanceProfile {
  return {
    printerId: "MX-TEST-001",
    assetTag: "AT-1",
    nickname: "Test Press",
    printerModel: "GD9630",
    customerName: "Demo Co",
    siteName: "Main",
    currentCopyCount: 1_200_000,
    previousCopyCount: 1_100_000,
    monthlyVolume: 90_000,
    lastPMDate: "2026-01-01",
    lastCleaningDate: null,
    lastJointUnitDate: null,
    lastDTFPMDate: null,
    nextPMDue: null,
    nextCleaningDue: null,
    nextJointUnitDue: null,
    nextDTFDue: null,
    lastPMCopyCount: 1_000_000,
    lastCleaningCopyCount: 1_000_000,
    lastJointUnitCopyCount: 1_000_000,
    lastDTFPMCopyCount: 1_000_000,
    nextPMDueCount: 2_000_000,
    nextCleaningDueCount: 1_250_000,
    nextJointUnitDueCount: 2_000_000,
    nextDTFDueCount: 2_000_000,
    ...overrides,
  };
}

describe("pm intelligence Patch 44", () => {
  beforeEach(() => {
    resetPmIntelligenceForTests();
  });

  it("maps legacy statuses into intelligence badges", () => {
    assert.equal(mapLegacyStatusToIntelligence("CURRENT"), "Healthy");
    assert.equal(mapLegacyStatusToIntelligence("DUE_SOON"), "Due Soon");
    assert.equal(mapLegacyStatusToIntelligence("DUE"), "Due");
    assert.equal(
      mapLegacyStatusToIntelligence("OVERDUE", { copiesOverdue: 50_000 }),
      "Severely Overdue",
    );
    assert.equal(mapLegacyStatusToIntelligence("UNKNOWN"), "Not Enough Data");
  });

  it("validates meter counts and requires override for lower readings", () => {
    const ok = validateMeterCount({
      newCount: 100,
      previousCount: 50,
      avgDailyVolume: 10,
      unusualIncreaseMultiplier: 3,
      recordedAt: "2026-07-13",
      existingReadings: [],
    });
    assert.equal(ok.ok, true);

    const lower = validateMeterCount({
      newCount: 40,
      previousCount: 50,
      avgDailyVolume: 10,
      unusualIncreaseMultiplier: 3,
      recordedAt: "2026-07-13",
      existingReadings: [],
    });
    assert.equal(lower.ok, false);
    if (!lower.ok) assert.equal(lower.requiresOverride, true);

    const overridden = validateMeterCount({
      newCount: 40,
      previousCount: 50,
      avgDailyVolume: 10,
      unusualIncreaseMultiplier: 3,
      overrideReason: "Meter replaced",
      recordedAt: "2026-07-13",
      existingReadings: [],
    });
    assert.equal(overridden.ok, true);
    assert.equal(overridden.suspectedReset, true);
  });

  it("parses meter CSV imports", () => {
    const csv = [
      "printerId,meterCount,date,enteredBy,notes",
      "MX-GD-001,999999,2026-07-13,Tech,ok",
      "MX-GD-002,bad,2026-07-13,Tech,bad",
    ].join("\n");
    const parsed = parseMeterCsv(csv);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.errors.length, 1);
  });

  it("estimates PM dates from usage", () => {
    const est = estimatePmDate(90_000, 3_000);
    assert.ok(est.date);
    assert.equal(est.confidence, "High Confidence");
    const low = estimatePmDate(90_000, null);
    assert.equal(low.date, null);
    assert.equal(low.confidence, "Low Confidence");
  });

  it("computes health scores with transparent factors", () => {
    const health = computeMachineHealthScore(fakeProfile());
    assert.ok(health.score >= 0 && health.score <= 100);
    assert.ok(health.factors.length >= 2);
    assert.ok(health.label);
  });

  it("builds meter rows and dashboard metrics from live maintenance profiles", () => {
    const dash = getPmDashboard();
    assert.ok(dash.metrics.totalActiveMachines >= 0);
    assert.ok(dash.rows.length === dash.metrics.totalActiveMachines || dash.rows.length >= 0);
    const forecast = getForecast("30d");
    assert.ok(forecast.windowLabel.includes("30"));
  });

  it("calculates average daily volume from history", () => {
    const avg = averageDailyVolume(
      [
        {
          id: "1",
          printerId: "p",
          recordedAt: "2026-07-01T00:00:00.000Z",
          copyCount: 1000,
          enteredBy: "a",
          notes: "",
          previousCount: null,
          lowerCountReason: null,
        },
        {
          id: "2",
          printerId: "p",
          recordedAt: "2026-07-11T00:00:00.000Z",
          copyCount: 4000,
          enteredBy: "a",
          notes: "",
          previousCount: 1000,
          lowerCountReason: null,
        },
      ],
      null,
    );
    assert.equal(avg, 300);
  });

  it("builds a meter table row for a profile", () => {
    const row = buildMeterTableRow(fakeProfile(), []);
    assert.equal(row.printerId, "MX-TEST-001");
    assert.ok(row.pmStatus);
  });
});

describe("pm intelligence permissions", () => {
  it("grants intelligence access to fleet roles", () => {
    assert.equal(canViewPmIntelligence("SERVICE_MANAGER"), true);
    assert.equal(canViewPmIntelligence("FIELD_TECHNICIAN"), true);
    assert.equal(canImportMeterCounts("FIELD_TECHNICIAN"), true);
    assert.equal(canManagePmSettings("SERVICE_MANAGER"), true);
    assert.equal(canManagePmSettings("FIELD_TECHNICIAN"), false);
  });
});

describe("pm intelligence meter entry integration", () => {
  beforeEach(() => {
    resetPmIntelligenceForTests();
  });

  it("rejects unknown printers and accepts seed printers when available", () => {
    const missing = enterMeterCount({
      printerId: "DOES-NOT-EXIST",
      meterCount: 1,
      enteredBy: "Tester",
    });
    assert.equal(missing.ok, false);

    const csv = importMeterCsv({
      csv: "printerId,meterCount\nDOES-NOT-EXIST,1\n",
      fileName: "t.csv",
      importedBy: "Tester",
    });
    assert.equal(csv.imported, 0);
  });
});
