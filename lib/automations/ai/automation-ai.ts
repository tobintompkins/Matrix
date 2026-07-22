/**
 * Patch 51A.2 — Deterministic AI helpers for automation conditions/actions.
 * No external provider required; structured validated output.
 */

export async function classifyAutomationCondition(input: {
  type: string;
  field: string;
  value?: unknown;
  payload: Record<string, unknown>;
  minConfidence: number;
}): Promise<{ matched: boolean; confidence: number; reason: string }> {
  const text = JSON.stringify(input.payload).toLowerCase();
  const needle = String(input.value ?? input.field ?? "").toLowerCase();

  let matched = false;
  let confidence = 0.75;
  let reason = "Deterministic AI condition evaluation.";

  if (input.type === "ai_classification" || input.type === "ai_summary_match") {
    const machineDown =
      /machine[- ]?down|completely offline|production down|not printing|out of service/.test(
        text,
      );
    if (needle.includes("machine-down") || needle.includes("emergency") || !needle) {
      matched = machineDown || /critical|emergency/.test(text);
      confidence = matched ? 0.93 : 0.72;
      reason = matched
        ? "Payload language suggests a machine-down or emergency situation."
        : "No strong machine-down language detected in payload.";
    } else {
      matched = text.includes(needle);
      confidence = matched ? 0.88 : 0.7;
      reason = matched
        ? `Payload matched classification target "${needle}".`
        : `Payload did not match "${needle}".`;
    }
  } else if (input.type === "ai_risk_score") {
    const score = /critical|emergency|down/.test(text) ? 0.9 : 0.4;
    const threshold = Number(input.value ?? 0.7);
    matched = score >= threshold;
    confidence = score;
    reason = `Risk score ${score.toFixed(2)} vs threshold ${threshold}.`;
  } else if (input.type === "ai_anomaly_check") {
    matched = Boolean(input.payload.anomaly || input.payload.severity === "CRITICAL");
    confidence = matched ? 0.9 : 0.7;
    reason = matched ? "Anomaly indicators present." : "No anomaly indicators.";
  }

  if (confidence < input.minConfidence) {
    return {
      matched: false,
      confidence,
      reason: `${reason} Below minimum confidence ${input.minConfidence}.`,
    };
  }
  return { matched, confidence, reason };
}

export function explainAutomationDecision(input: {
  matched: boolean;
  results: Array<{ reason: string; matched: boolean }>;
}): string {
  const parts = input.results.map(
    (r) => `${r.matched ? "PASS" : "FAIL"}: ${r.reason}`,
  );
  return `Decision: ${input.matched ? "conditions matched" : "conditions did not match"}. ${parts.join("; ")}`;
}
