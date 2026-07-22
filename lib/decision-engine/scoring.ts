/**
 * Patch 51A.4 — Deterministic decision scoring (no AI).
 */

import {
  DECISION_THRESHOLDS,
  DEFAULT_DECISION_WEIGHTS,
  type DecisionEngineWeights,
  type DecisionPriority,
  type DecisionScores,
} from "./types";

export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * overall = 35% risk + 25% urgency + 20% business impact + 10% SLA + 10% confidence
 */
export function computeOverallDecisionScore(
  input: {
    riskScore: number;
    urgencyScore: number;
    businessImpactScore: number;
    slaImpactScore: number;
    confidenceScore: number;
  },
  weights: DecisionEngineWeights = DEFAULT_DECISION_WEIGHTS,
): number {
  const raw =
    input.riskScore * weights.riskWeight +
    input.urgencyScore * weights.urgencyWeight +
    input.businessImpactScore * weights.businessImpactWeight +
    input.slaImpactScore * weights.slaWeight +
    input.confidenceScore * weights.confidenceWeight;
  return clampScore(raw);
}

export function priorityFromOverall(overall: number): DecisionPriority {
  if (overall >= DECISION_THRESHOLDS.criticalOverall) return "CRITICAL";
  if (overall >= DECISION_THRESHOLDS.highOverall) return "HIGH";
  if (overall >= DECISION_THRESHOLDS.mediumOverall) return "MEDIUM";
  if (overall >= 25) return "LOW";
  return "INFORMATIONAL";
}

export function buildScores(
  partial: {
    riskScore: number;
    urgencyScore: number;
    businessImpactScore: number;
    confidenceScore: number;
    slaImpactScore?: number;
  },
  weights?: DecisionEngineWeights,
): DecisionScores {
  const slaImpactScore = clampScore(partial.slaImpactScore ?? 0);
  const riskScore = clampScore(partial.riskScore);
  const urgencyScore = clampScore(partial.urgencyScore);
  const businessImpactScore = clampScore(partial.businessImpactScore);
  const confidenceScore = clampScore(partial.confidenceScore);
  return {
    riskScore,
    urgencyScore,
    businessImpactScore,
    confidenceScore,
    slaImpactScore,
    overallDecisionScore: computeOverallDecisionScore(
      {
        riskScore,
        urgencyScore,
        businessImpactScore,
        slaImpactScore,
        confidenceScore,
      },
      weights,
    ),
  };
}

/** Map predictive risk level to risk/urgency seeds. */
export function scoresFromPredictiveRisk(input: {
  riskLevel: string;
  healthScore: number;
  confidenceScore: number;
  dataQualityScore: number;
  pmOverdue?: boolean;
  machineDown?: boolean;
}): DecisionScores {
  const riskMap: Record<string, number> = {
    CRITICAL: 92,
    HIGH: 75,
    MODERATE: 55,
    LOW: 25,
    UNKNOWN: 40,
  };
  const riskScore =
    riskMap[input.riskLevel] ?? Math.max(0, 100 - input.healthScore);
  const urgencyScore = clampScore(
    (input.pmOverdue ? 35 : 0) +
      (input.machineDown ? 40 : 0) +
      (input.riskLevel === "CRITICAL" ? 30 : input.riskLevel === "HIGH" ? 20 : 10),
  );
  const businessImpactScore = clampScore(
    input.machineDown ? 85 : input.riskLevel === "CRITICAL" ? 70 : 45,
  );
  const confidenceScore = clampScore(
    (input.confidenceScore + input.dataQualityScore) / 2,
  );
  return buildScores({
    riskScore,
    urgencyScore,
    businessImpactScore,
    confidenceScore,
    slaImpactScore: input.machineDown ? 80 : input.pmOverdue ? 50 : 20,
  });
}
