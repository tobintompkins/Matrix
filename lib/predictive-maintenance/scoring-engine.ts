/**
 * Patch 51A.3 — Deterministic health scoring engine.
 */

import { assessMachineDataReadiness } from "./data-readiness";
import { calculateMaintenanceForecast } from "./forecast";
import { detectRiskFactors } from "./risk-detectors";
import type {
  DefaultPredictiveSettings,
  EvaluationResult,
  MachinePredictiveInput,
  PredictiveRiskLevel,
  ScoreBreakdown,
  ScoreFactor,
} from "./types";
import {
  DEFAULT_PREDICTIVE_SETTINGS,
  DEFAULT_WEIGHTS,
  SCORING_VERSION,
} from "./types";
import { buildRecommendations } from "./recommendations";
import { buildAlerts } from "./alerts";

export function riskLevelFromScore(
  score: number,
  dataQuality: number,
  settings: DefaultPredictiveSettings,
): PredictiveRiskLevel {
  if (dataQuality < settings.minimumDataQualityScore) return "UNKNOWN";
  if (score <= 24 || score < settings.healthScoreCriticalThreshold * 0.6) {
    return "CRITICAL";
  }
  if (score < settings.healthScoreCriticalThreshold) return "HIGH";
  if (score < settings.healthScoreWarningThreshold) return "MODERATE";
  return "LOW";
}

export function computeHealthScore(
  input: MachinePredictiveInput,
  settings: DefaultPredictiveSettings = DEFAULT_PREDICTIVE_SETTINGS,
  weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS,
): { breakdown: ScoreBreakdown; componentScores: Record<string, number> } {
  const deductions: ScoreFactor[] = [];
  const bonuses: ScoreFactor[] = [];
  let base = 100;

  const factors = detectRiskFactors(input, settings);
  const componentScores = {
    failureRiskScore: 0,
    pmUrgencyScore: 0,
    usageStressScore: 0,
    repeatIssueScore: 0,
    downtimeRiskScore: 0,
  };

  for (const f of factors) {
    const points = Math.min(f.scoreImpact, 30);
    deductions.push({
      factor: f.key,
      points,
      reason: f.explanation,
    });
    if (f.key === "REPEAT_FAILURE") componentScores.repeatIssueScore += points;
    else if (f.key === "PM_OVERDUE") componentScores.pmUrgencyScore += points;
    else if (f.key === "USAGE_SPIKE") componentScores.usageStressScore += points;
    else if (f.key === "MACHINE_DOWN" || f.key === "OPEN_EMERGENCY") {
      componentScores.failureRiskScore += points;
      componentScores.downtimeRiskScore += points * 0.5;
    } else if (f.key === "STALE_METER" || f.key === "MISSING_METER") {
      /* data quality handled separately */
    } else {
      componentScores.failureRiskScore += points * 0.5;
    }
  }

  // Due soon (not overdue)
  if (
    input.currentMeterCount != null &&
    input.nextPmDueCount != null &&
    input.pmInterval != null &&
    input.currentMeterCount <= input.nextPmDueCount
  ) {
    const remaining = input.nextPmDueCount - input.currentMeterCount;
    const threshold = Math.max(
      1,
      Math.floor(input.pmInterval * 0.1),
    );
    if (remaining <= threshold) {
      deductions.push({
        factor: "PM_DUE_SOON",
        points: weights.pmDueSoon,
        reason: `PM due soon — ${remaining} impressions remaining (threshold ${threshold}).`,
      });
      componentScores.pmUrgencyScore += weights.pmDueSoon;
    }
  }

  // Recent successful PM bonus
  if (input.lastPmAt) {
    const days = (Date.now() - new Date(input.lastPmAt).getTime()) / 86_400_000;
    if (days >= 0 && days <= 45) {
      bonuses.push({
        factor: "RECENT_SUCCESSFUL_PM",
        points: weights.recentSuccessfulPm,
        reason: "A PM completion was recorded within the last 45 days.",
      });
    }
  }

  const deductionTotal = deductions.reduce((s, d) => s + d.points, 0);
  const bonusTotal = bonuses.reduce((s, b) => s + b.points, 0);
  const finalScore = Math.max(0, Math.min(100, base - deductionTotal + bonusTotal));

  return {
    breakdown: {
      baseScore: base,
      deductions,
      bonuses,
      finalScore,
    },
    componentScores,
  };
}

export function evaluateMachineDeterministic(
  input: MachinePredictiveInput,
  settings: DefaultPredictiveSettings = DEFAULT_PREDICTIVE_SETTINGS,
): EvaluationResult {
  const readiness = assessMachineDataReadiness(input, {
    staleMeterDays: settings.staleMeterDays,
  });
  const riskFactors = detectRiskFactors(input, settings);
  const { breakdown, componentScores } = computeHealthScore(input, settings);
  const forecast = calculateMaintenanceForecast(input, {
    pmDueSoonDays: settings.pmDueSoonDays,
  });

  let healthScore = breakdown.finalScore;
  let confidenceScore = Math.round(
    (readiness.score * 0.6 + forecast.confidenceScore * 0.4),
  );

  if (readiness.score < settings.minimumDataQualityScore) {
    confidenceScore = Math.min(confidenceScore, 40);
  }

  const riskLevel = riskLevelFromScore(
    healthScore,
    readiness.score,
    settings,
  );

  const primary =
    breakdown.deductions.sort((a, b) => b.points - a.points)[0]?.reason ??
    (riskLevel === "LOW"
      ? "No major risk factors detected from available data."
      : "Insufficient data for a specific primary risk reason.");

  const recommendations = buildRecommendations(input, {
    riskLevel,
    readiness,
    forecast,
    riskFactors,
    healthScore,
  });
  const alerts = buildAlerts(input, {
    riskLevel,
    readiness,
    riskFactors,
    healthScore,
    previousHealthScore: null,
    settings,
    confidenceScore,
  });

  return {
    machineId: input.machineId,
    healthScore,
    riskLevel,
    dataQualityScore: readiness.score,
    confidenceScore,
    failureRiskScore: componentScores.failureRiskScore,
    pmUrgencyScore: componentScores.pmUrgencyScore,
    usageStressScore: componentScores.usageStressScore,
    repeatIssueScore: componentScores.repeatIssueScore,
    downtimeRiskScore: componentScores.downtimeRiskScore,
    primaryRiskReason: primary,
    breakdown,
    riskFactors,
    forecast,
    readiness,
    recommendations,
    alerts,
    inputSummary: {
      printerModel: input.printerModel,
      currentMeter: input.currentMeterCount,
      pmInterval: input.pmInterval,
      nextPmDueCount: input.nextPmDueCount,
      openServiceCalls: input.serviceCalls.filter(
        (c) => !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status),
      ).length,
      meterHistoryCount: input.meterHistory.length,
    },
    scoringVersion: settings.scoringVersion || SCORING_VERSION,
  };
}
