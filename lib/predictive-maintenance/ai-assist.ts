/**
 * Patch 51A.3 — Optional AI explanation helpers (fail-open).
 * Deterministic scoring never depends on these succeeding.
 */

import type { EvaluationResult } from "./types";
import { AI_EXPLANATION_VERSION } from "./types";

export type AiHealthExplanation = {
  summary: string;
  confidence: number;
  promptVersion: string;
  isSample: boolean;
};

/**
 * Structured explanation. Uses a deterministic template when no LLM is wired,
 * matching Matrix Assist sample-mode behavior for local/dev.
 */
export async function summarizeMachineHealth(
  result: EvaluationResult,
): Promise<AiHealthExplanation> {
  try {
    const top = result.breakdown.deductions
      .slice()
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((d) => d.reason)
      .join(" ");
    return {
      summary: `Predicted health score ${result.healthScore} (${result.riskLevel}). ${result.primaryRiskReason}${top ? ` Key factors: ${top}` : ""} Confidence ${result.confidenceScore}% based on data quality ${result.dataQualityScore}. This is a prediction, not a confirmed failure.`,
      confidence: Math.min(result.confidenceScore, 80) / 100,
      promptVersion: AI_EXPLANATION_VERSION,
      isSample: true,
    };
  } catch {
    return {
      summary: "AI explanation unavailable; deterministic score still applies.",
      confidence: 0,
      promptVersion: AI_EXPLANATION_VERSION,
      isSample: true,
    };
  }
}

export async function explainHealthScore(result: EvaluationResult) {
  return summarizeMachineHealth(result);
}

export async function recommendMaintenanceActions(result: EvaluationResult) {
  return {
    actions: result.recommendations.map((r) => ({
      type: r.recommendationType,
      title: r.title,
      reason: r.reason,
    })),
    promptVersion: AI_EXPLANATION_VERSION,
    isSample: true,
  };
}

export async function classifyServiceIssueTheme(text: string) {
  const t = text.toLowerCase();
  let theme = "general";
  if (t.includes("jam") || t.includes("misfeed")) theme = "paper_path";
  else if (t.includes("image") || t.includes("quality")) theme = "image_quality";
  else if (t.includes("error") || t.includes("code")) theme = "error_code";
  return { theme, confidence: 0.55, promptVersion: AI_EXPLANATION_VERSION, isSample: true };
}

export async function detectRepeatIssuePattern(titles: string[]) {
  const normalized = titles.map((t) => t.toLowerCase().trim());
  const counts = new Map<string, number>();
  for (const n of normalized) counts.set(n, (counts.get(n) ?? 0) + 1);
  const repeats = [...counts.entries()].filter(([, c]) => c >= 2);
  return {
    hasRepeat: repeats.length > 0,
    themes: repeats.map(([theme, count]) => ({ theme, count })),
    promptVersion: AI_EXPLANATION_VERSION,
    isSample: true,
  };
}

export async function extractMaintenanceSignals(notes: string) {
  return {
    signals: notes
      ? [{ kind: "note_present", summary: notes.slice(0, 120) }]
      : [],
    promptVersion: AI_EXPLANATION_VERSION,
    isSample: true,
  };
}
