/**
 * Patch 51A.3 — Predictive risk alert drafts.
 */

import type {
  DefaultPredictiveSettings,
  DraftAlert,
  MachineDataReadiness,
  MachinePredictiveInput,
  PredictiveRiskFactor,
  PredictiveRiskLevel,
} from "./types";

export function buildAlerts(
  input: MachinePredictiveInput,
  ctx: {
    riskLevel: PredictiveRiskLevel;
    readiness: MachineDataReadiness;
    riskFactors: PredictiveRiskFactor[];
    healthScore: number;
    previousHealthScore: number | null;
    settings: DefaultPredictiveSettings;
    confidenceScore: number;
  },
): DraftAlert[] {
  const alerts: DraftAlert[] = [];
  if (ctx.confidenceScore < ctx.settings.minimumConfidenceForAlert) {
    // Still allow critical factual alerts
  }

  if (ctx.riskLevel === "CRITICAL") {
    alerts.push({
      alertType: "CRITICAL_RISK",
      severity: "CRITICAL",
      title: `Critical predictive risk — ${input.machineId}`,
      message: ctx.riskFactors[0]?.explanation ?? `Health score ${ctx.healthScore}`,
      dedupeKey: `critical-risk:${input.machineId}`,
    });
  }

  if (ctx.riskFactors.some((f) => f.key === "PM_OVERDUE")) {
    alerts.push({
      alertType: "PM_OVERDUE_RISK",
      severity: "HIGH",
      title: `PM overdue risk — ${input.machineId}`,
      message: "Meter indicates PM is past due.",
      dedupeKey: `pm-overdue:${input.machineId}`,
    });
  }

  if (ctx.riskFactors.some((f) => f.key === "REPEAT_FAILURE")) {
    alerts.push({
      alertType: "REPEAT_FAILURE",
      severity: "HIGH",
      title: `Repeat failure pattern — ${input.machineId}`,
      message: "Similar service issues recur within the lookback window.",
      dedupeKey: `repeat-failure:${input.machineId}`,
    });
  }

  if (ctx.riskFactors.some((f) => f.key === "USAGE_SPIKE")) {
    alerts.push({
      alertType: "RAPID_USAGE_INCREASE",
      severity: "WARNING",
      title: `Usage spike — ${input.machineId}`,
      message: "Recent usage increased sharply versus the earlier period.",
      dedupeKey: `usage-spike:${input.machineId}`,
    });
  }

  if (!ctx.readiness.ready || ctx.readiness.score < ctx.settings.minimumDataQualityScore) {
    alerts.push({
      alertType: "MISSING_DATA",
      severity: "WARNING",
      title: `Low predictive data quality — ${input.machineId}`,
      message: ctx.readiness.missingFields.join(", ") || "Data quality below threshold",
      dedupeKey: `missing-data:${input.machineId}`,
    });
  }

  if (
    ctx.previousHealthScore != null &&
    ctx.previousHealthScore - ctx.healthScore >= 15
  ) {
    alerts.push({
      alertType: "HEALTH_SCORE_DROP",
      severity: "HIGH",
      title: `Health score drop — ${input.machineId}`,
      message: `Score fell from ${ctx.previousHealthScore} to ${ctx.healthScore}.`,
      dedupeKey: `score-drop:${input.machineId}:${new Date().toISOString().slice(0, 10)}`,
    });
  }

  return alerts;
}
