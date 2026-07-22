/**
 * Patch 51A.5 Part 1 — Explainable executive fleet-health score.
 * Deterministic; does not invent missing inputs.
 */

import type { FleetHealthFactor, FleetHealthStatus } from "./types";

export type FleetHealthInput = {
  activeMachines: number;
  criticalServiceCalls: number;
  openServiceCalls: number;
  pmOverdue: number;
  machinesAtRisk: number;
  criticalAlerts: number;
  dataFreshnessScore: number | null;
};

export function classifyFleetHealth(score: number | null): FleetHealthStatus {
  if (score == null) return "unknown";
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 55) return "watch";
  return "critical";
}

/**
 * Start at 100 and subtract explainable penalties. Missing modules reduce confidence,
 * not invent optimistic scores.
 */
export function computeExecutiveFleetHealth(input: FleetHealthInput): {
  score: number | null;
  status: FleetHealthStatus;
  confidence: number;
  factors: FleetHealthFactor[];
} {
  if (input.activeMachines <= 0) {
    return {
      score: null,
      status: "unknown",
      confidence: 0,
      factors: [
        {
          key: "activeMachines",
          label: "Active machines",
          value: 0,
          impact: "neutral",
          note: "No active machines found — score withheld.",
        },
      ],
    };
  }

  let score = 100;
  const factors: FleetHealthFactor[] = [];

  const criticalPenalty = Math.min(40, input.criticalServiceCalls * 12);
  score -= criticalPenalty;
  factors.push({
    key: "criticalServiceCalls",
    label: "Critical / emergency service calls",
    value: input.criticalServiceCalls,
    impact: criticalPenalty > 0 ? "negative" : "positive",
    note:
      criticalPenalty > 0
        ? `−${criticalPenalty} for open critical calls`
        : "No open critical calls",
  });

  const riskPenalty = Math.min(30, input.machinesAtRisk * 8);
  score -= riskPenalty;
  factors.push({
    key: "machinesAtRisk",
    label: "Machines at predictive risk (HIGH/CRITICAL)",
    value: input.machinesAtRisk,
    impact: riskPenalty > 0 ? "negative" : "positive",
    note:
      riskPenalty > 0
        ? `−${riskPenalty} for predictive risk`
        : "No high/critical predictive risk machines",
  });

  const pmPenalty = Math.min(25, input.pmOverdue * 5);
  score -= pmPenalty;
  factors.push({
    key: "pmOverdue",
    label: "PM overdue (meter)",
    value: input.pmOverdue,
    impact: pmPenalty > 0 ? "negative" : "positive",
    note:
      pmPenalty > 0 ? `−${pmPenalty} for overdue PM` : "No meter-overdue PM",
  });

  const alertPenalty = Math.min(20, input.criticalAlerts * 6);
  score -= alertPenalty;
  factors.push({
    key: "criticalAlerts",
    label: "Critical alerts",
    value: input.criticalAlerts,
    impact: alertPenalty > 0 ? "negative" : "positive",
    note:
      alertPenalty > 0
        ? `−${alertPenalty} for open critical alerts`
        : "No open critical alerts",
  });

  const openRatio =
    input.activeMachines > 0
      ? input.openServiceCalls / input.activeMachines
      : 0;
  const openPenalty = Math.min(15, Math.round(openRatio * 20));
  score -= openPenalty;
  factors.push({
    key: "openServiceLoad",
    label: "Open service call load vs fleet",
    value: Math.round(openRatio * 100),
    impact: openPenalty > 0 ? "negative" : "neutral",
    note: `${input.openServiceCalls} open calls across ${input.activeMachines} machines`,
  });

  factors.push({
    key: "activeMachines",
    label: "Active machines in scope",
    value: input.activeMachines,
    impact: "positive",
  });

  const freshness = input.dataFreshnessScore;
  let confidence = 55;
  if (freshness != null) {
    confidence = Math.round(40 + freshness * 0.5);
    factors.push({
      key: "dataFreshness",
      label: "Data freshness / completeness",
      value: freshness,
      impact: freshness >= 60 ? "positive" : "negative",
      note:
        freshness < 40
          ? "Low data completeness — treat score as directional only"
          : "Signals available for scoring",
    });
  } else {
    confidence = 35;
    factors.push({
      key: "dataFreshness",
      label: "Data freshness / completeness",
      value: null,
      impact: "neutral",
      note: "Freshness unavailable",
    });
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: clamped,
    status: classifyFleetHealth(clamped),
    confidence: Math.max(0, Math.min(100, confidence)),
    factors,
  };
}
