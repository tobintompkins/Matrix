import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessMachineDataReadiness } from "./data-readiness";
import { calculateMaintenanceForecast } from "./forecast";
import { detectRiskFactors } from "./risk-detectors";
import { evaluateMachineDeterministic } from "./scoring-engine";
import { buildRecommendations } from "./recommendations";
import { buildAlerts } from "./alerts";
import {
  DEFAULT_PREDICTIVE_SETTINGS,
  type MachinePredictiveInput,
} from "./types";
import { summarizeMachineHealth } from "./ai-assist";

function sampleMachine(
  overrides: Partial<MachinePredictiveInput> = {},
): MachinePredictiveInput {
  return {
    machineId: "MX-TEST-001",
    printerModel: "GD9630",
    customerName: "Acme",
    siteName: "Main",
    active: true,
    currentMeterCount: 520_000,
    lastPmCount: 500_000,
    lastPmAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    pmInterval: 50_000,
    nextPmDueCount: 550_000,
    installDate: "2022-01-15",
    meterHistory: [
      {
        meterCount: 480_000,
        recordedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      },
      {
        meterCount: 500_000,
        recordedAt: new Date(Date.now() - 45 * 86_400_000).toISOString(),
      },
      {
        meterCount: 520_000,
        recordedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      },
    ],
    serviceCalls: [],
    ...overrides,
  };
}

describe("predictive data readiness", () => {
  it("scores ready machines with usable signals", () => {
    const readiness = assessMachineDataReadiness(sampleMachine());
    assert.equal(readiness.ready, true);
    assert.ok(readiness.score >= 40);
    assert.ok(readiness.usableSignals.includes("pmInterval"));
  });

  it("flags missing model and meters", () => {
    const readiness = assessMachineDataReadiness(
      sampleMachine({
        printerModel: null,
        currentMeterCount: null,
        meterHistory: [],
        pmInterval: null,
      }),
    );
    assert.ok(readiness.missingFields.includes("printerModel"));
    assert.ok(readiness.missingFields.includes("meterHistory"));
    assert.ok(readiness.score < 70);
  });
});

describe("predictive forecast", () => {
  it("estimates a predicted date from usage", () => {
    const forecast = calculateMaintenanceForecast(sampleMachine());
    assert.ok(forecast.impressionsRemaining != null);
    assert.ok(forecast.impressionsRemaining! > 0);
    assert.ok(forecast.confidenceScore > 0);
  });

  it("handles sparse / zero usage without inventing certainty", () => {
    const forecast = calculateMaintenanceForecast(
      sampleMachine({
        meterHistory: [
          {
            meterCount: 520_000,
            recordedAt: new Date().toISOString(),
          },
        ],
      }),
    );
    assert.ok(forecast.confidenceScore <= 60 || forecast.predictedDueDate == null);
  });
});

describe("risk detectors and scoring", () => {
  it("detects repeat failures", () => {
    const now = Date.now();
    const factors = detectRiskFactors(
      sampleMachine({
        serviceCalls: [
          {
            id: "1",
            status: "CLOSED",
            priority: "NORMAL",
            issueTitle: "Tray 2 misfeed",
            createdAt: new Date(now - 10 * 86_400_000).toISOString(),
            updatedAt: new Date(now - 9 * 86_400_000).toISOString(),
          },
          {
            id: "2",
            status: "CLOSED",
            priority: "NORMAL",
            issueTitle: "Tray 2 misfeed",
            createdAt: new Date(now - 5 * 86_400_000).toISOString(),
            updatedAt: new Date(now - 4 * 86_400_000).toISOString(),
          },
          {
            id: "3",
            status: "OPEN",
            priority: "HIGH",
            issueTitle: "Tray 2 misfeed",
            createdAt: new Date(now - 1 * 86_400_000).toISOString(),
            updatedAt: new Date(now - 1 * 86_400_000).toISOString(),
          },
        ],
      }),
    );
    assert.ok(factors.some((f) => f.key === "REPEAT_FAILURE"));
  });

  it("detects PM overdue by meter", () => {
    const factors = detectRiskFactors(
      sampleMachine({
        currentMeterCount: 600_000,
        nextPmDueCount: 550_000,
      }),
    );
    assert.ok(factors.some((f) => f.key === "PM_OVERDUE"));
  });

  it("produces an explainable score breakdown", () => {
    const result = evaluateMachineDeterministic(
      sampleMachine({
        currentMeterCount: 600_000,
        nextPmDueCount: 550_000,
      }),
    );
    assert.ok(result.healthScore < 100);
    assert.ok(result.breakdown.deductions.length > 0);
    assert.equal(result.scoringVersion.length > 0, true);
    assert.notEqual(result.riskLevel, undefined);
  });

  it("uses UNKNOWN risk when data quality is poor", () => {
    const result = evaluateMachineDeterministic(
      sampleMachine({
        printerModel: null,
        currentMeterCount: null,
        meterHistory: [],
        pmInterval: null,
        nextPmDueCount: null,
        lastPmAt: null,
        lastPmCount: null,
      }),
      {
        ...DEFAULT_PREDICTIVE_SETTINGS,
        minimumDataQualityScore: 80,
      },
    );
    assert.equal(result.riskLevel, "UNKNOWN");
  });
});

describe("recommendations and alerts", () => {
  it("recommends expedite PM when overdue", () => {
    const input = sampleMachine({
      currentMeterCount: 600_000,
      nextPmDueCount: 550_000,
    });
    const result = evaluateMachineDeterministic(input);
    const recs = buildRecommendations(input, {
      riskLevel: result.riskLevel,
      readiness: result.readiness,
      forecast: result.forecast,
      riskFactors: result.riskFactors,
      healthScore: result.healthScore,
    });
    assert.ok(recs.some((r) => r.recommendationType === "EXPEDITE_PM"));
  });

  it("builds critical alert for critical risk", () => {
    const alerts = buildAlerts(sampleMachine(), {
      riskLevel: "CRITICAL",
      readiness: assessMachineDataReadiness(sampleMachine()),
      riskFactors: [],
      healthScore: 20,
      previousHealthScore: 80,
      settings: DEFAULT_PREDICTIVE_SETTINGS,
      confidenceScore: 70,
    });
    assert.ok(alerts.some((a) => a.alertType === "CRITICAL_RISK"));
    assert.ok(alerts.some((a) => a.alertType === "HEALTH_SCORE_DROP"));
  });
});

describe("AI assist fail-open", () => {
  it("returns structured sample explanation", async () => {
    const result = evaluateMachineDeterministic(sampleMachine());
    const explanation = await summarizeMachineHealth(result);
    assert.match(explanation.summary, /Predicted health score/i);
    assert.equal(explanation.isSample, true);
  });
});
