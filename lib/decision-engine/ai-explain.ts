/**
 * Patch 51A.4 — Deterministic AI explanation layer (sample/fail-open).
 * Never invents missing evidence or changes scores.
 */

import {
  DECISION_AI_EXPLANATION_VERSION,
  type DraftDecision,
} from "./types";

export type DecisionAiExplanation = {
  whyItMatters: string;
  whyRecommended: string;
  nextStep: string;
  provider: string;
  model: string;
  isSample: boolean;
  promptVersion: string;
};

export async function explainDecisionDeterministic(
  draft: DraftDecision,
): Promise<DecisionAiExplanation> {
  const availableFacts = draft.evidence.facts.filter((f) => f.available);
  const unavailable = draft.evidence.facts.filter((f) => !f.available);

  const whyRecommended =
    availableFacts.length > 0
      ? `Matrix ranked this from ${availableFacts.length} available operational signals: ${availableFacts
          .slice(0, 4)
          .map((f) => `${f.label}=${String(f.value)}`)
          .join("; ")}.${
          unavailable.length
            ? ` ${unavailable.length} signal(s) marked unavailable and were not invented.`
            : ""
        }`
      : "Limited evidence was available; confidence is accordingly lower. Missing values were not invented.";

  return {
    whyItMatters: draft.summary,
    whyRecommended,
    nextStep: draft.recommendedAction,
    provider: "matrix-local",
    model: "deterministic-template",
    isSample: true,
    promptVersion: DECISION_AI_EXPLANATION_VERSION,
  };
}
