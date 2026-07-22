/**
 * Patch 51A.3 — Recommendation rules.
 */

import type {
  DraftRecommendation,
  MachineDataReadiness,
  MachinePredictiveInput,
  MaintenanceForecastResult,
  PredictiveRiskFactor,
  PredictiveRiskLevel,
} from "./types";

export function buildRecommendations(
  input: MachinePredictiveInput,
  ctx: {
    riskLevel: PredictiveRiskLevel;
    readiness: MachineDataReadiness;
    forecast: MaintenanceForecastResult;
    riskFactors: PredictiveRiskFactor[];
    healthScore: number;
  },
): DraftRecommendation[] {
  const recs: DraftRecommendation[] = [];
  const has = (key: string) => ctx.riskFactors.some((f) => f.key === key);

  if (!ctx.readiness.ready || ctx.readiness.score < 40) {
    recs.push({
      recommendationType: "DATA_CORRECTION",
      priority: "HIGH",
      title: "Improve predictive data quality",
      description:
        "Capture missing meter, model, or PM interval data before relying on predictions.",
      reason: ctx.readiness.missingFields.join(", ") || "Low data-quality score",
      confidenceScore: 80,
      dedupeKey: `data-correction:${input.machineId}`,
    });
  }

  if (has("STALE_METER") || has("MISSING_METER")) {
    recs.push({
      recommendationType: "CHECK_METER",
      priority: "NORMAL",
      title: "Record a current meter reading",
      description: "Meter data is stale or missing; update the reading to improve forecasts.",
      reason: "Stale or missing meter history",
      confidenceScore: 85,
      dedupeKey: `check-meter:${input.machineId}`,
    });
  }

  if (has("PM_OVERDUE") || (ctx.forecast.impressionsRemaining != null && ctx.forecast.impressionsRemaining < 0)) {
    recs.push({
      recommendationType: "EXPEDITE_PM",
      priority: "URGENT",
      title: "Expedite preventive maintenance",
      description: "PM appears overdue by meter. Schedule and complete PM promptly.",
      reason: "PM overdue and/or elevated health risk",
      confidenceScore: 85,
      dedupeKey: `expedite-pm:${input.machineId}`,
    });
  } else if (
    ctx.forecast.daysRemaining != null &&
    ctx.forecast.daysRemaining <= 14 &&
    ctx.forecast.daysRemaining >= 0
  ) {
    recs.push({
      recommendationType: "SCHEDULE_PM",
      priority: "HIGH",
      title: "Schedule upcoming PM",
      description: `Predicted maintenance window opens around ${ctx.forecast.predictedDueDate ?? "soon"}.`,
      reason: ctx.forecast.explanation,
      confidenceScore: ctx.forecast.confidenceScore,
      dedupeKey: `schedule-pm:${input.machineId}`,
    });
  }

  if (has("REPEAT_FAILURE")) {
    recs.push({
      recommendationType: "REVIEW_REPEAT_FAILURE",
      priority: "HIGH",
      title: "Review repeat failure pattern",
      description: "Similar service issues recur within the lookback window.",
      reason: "Repeat-failure detector triggered",
      confidenceScore: 75,
      dedupeKey: `repeat-failure:${input.machineId}`,
    });
  }

  if (has("OPEN_EMERGENCY") || has("MACHINE_DOWN")) {
    recs.push({
      recommendationType: "CREATE_SERVICE_CALL",
      priority: "URGENT",
      title: "Confirm open critical service work",
      description:
        "Critical open work or down status detected. Recommendation only — creation requires approval workflow.",
      reason: "Open emergency/critical call or machine down",
      confidenceScore: 90,
      dedupeKey: `create-sc:${input.machineId}`,
    });
  }

  if (ctx.riskLevel === "LOW" || ctx.riskLevel === "MODERATE") {
    if (!recs.some((r) => r.recommendationType === "MONITOR")) {
      recs.push({
        recommendationType: "MONITOR",
        priority: "LOW",
        title: "Continue monitoring",
        description: "No urgent predictive action required from current signals.",
        reason: `Risk level ${ctx.riskLevel}; health score ${ctx.healthScore}`,
        confidenceScore: ctx.readiness.score,
        dedupeKey: `monitor:${input.machineId}`,
      });
    }
  }

  return recs;
}
