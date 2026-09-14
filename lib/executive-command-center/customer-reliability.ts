/**
 * Patch 51C.1 — Customer reliability scoring from service + predictive signals.
 * Deterministic 0–100 score; does not invent CRM sentiment.
 */

export type CustomerReliabilityLabel =
  | "Healthy"
  | "Watch"
  | "At Risk"
  | "Critical";

export type CustomerReliabilityInput = {
  openCalls: number;
  criticalCalls: number;
  machinesAtRisk: number;
  /** Repeat visits (≥3 calls / 90d) for this customer, if known. */
  repeatCallSites?: number;
};

export type CustomerReliabilityResult = {
  reliabilityScore: number;
  riskLabel: CustomerReliabilityLabel;
  factors: Array<{ key: string; note: string; penalty: number }>;
};

/**
 * Start at 100; subtract explainable penalties from live operational pressure.
 */
export function computeCustomerReliabilityScore(
  input: CustomerReliabilityInput,
): CustomerReliabilityResult {
  let score = 100;
  const factors: CustomerReliabilityResult["factors"] = [];

  const criticalPenalty = Math.min(45, input.criticalCalls * 15);
  if (criticalPenalty > 0) {
    score -= criticalPenalty;
    factors.push({
      key: "criticalCalls",
      note: `${input.criticalCalls} critical/emergency open call(s)`,
      penalty: criticalPenalty,
    });
  }

  const openPenalty = Math.min(25, Math.max(0, input.openCalls - 1) * 5);
  if (openPenalty > 0) {
    score -= openPenalty;
    factors.push({
      key: "openCalls",
      note: `${input.openCalls} open service call(s)`,
      penalty: openPenalty,
    });
  }

  const riskPenalty = Math.min(30, input.machinesAtRisk * 12);
  if (riskPenalty > 0) {
    score -= riskPenalty;
    factors.push({
      key: "machinesAtRisk",
      note: `${input.machinesAtRisk} machine(s) at predictive risk`,
      penalty: riskPenalty,
    });
  }

  const repeats = input.repeatCallSites ?? 0;
  const repeatPenalty = Math.min(20, repeats * 8);
  if (repeatPenalty > 0) {
    score -= repeatPenalty;
    factors.push({
      key: "repeatCalls",
      note: `${repeats} repeat-pressure site(s)`,
      penalty: repeatPenalty,
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let riskLabel: CustomerReliabilityLabel = "Healthy";
  if (score < 40 || input.criticalCalls > 0) riskLabel = "Critical";
  else if (score < 60 || input.machinesAtRisk > 0) riskLabel = "At Risk";
  else if (score < 80 || input.openCalls > 0) riskLabel = "Watch";

  return { reliabilityScore: score, riskLabel, factors };
}
