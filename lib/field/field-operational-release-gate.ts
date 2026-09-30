import type { FieldReleaseDecisionRecord } from "./field-release-decision";
import type { FieldReleaseReadinessSummary } from "./field-release-readiness";
import type { FieldSyncOperationsHealth } from "./sync-operations-health";

export type FieldOperationalReleaseGate = {
  state: "ready" | "blocked";
  headline: string;
  reasons: string[];
  readiness: FieldReleaseReadinessSummary;
  latestDecision: FieldReleaseDecisionRecord;
  syncHealth: FieldSyncOperationsHealth;
};

/**
 * Advisory gate for managers. It combines evidence that already exists and
 * never changes a bridge flag, receipt, verification, or work order.
 */
export function evaluateFieldOperationalReleaseGate(input: {
  readiness: FieldReleaseReadinessSummary;
  latestDecision: FieldReleaseDecisionRecord;
  syncHealth: FieldSyncOperationsHealth;
}): FieldOperationalReleaseGate {
  const reasons: string[] = [];
  if (input.readiness.state !== "ready") {
    reasons.push("The latest finalized device verification is not release-ready.");
  }
  if (input.latestDecision.status !== "approved") {
    reasons.push("A manager has not approved the latest Field release decision.");
  }
  if (
    input.readiness.submissionId &&
    input.latestDecision.verificationSubmissionId !== input.readiness.submissionId
  ) {
    reasons.push("The latest approval does not match the latest finalized verification.");
  }
  if (input.syncHealth.received > 0) {
    reasons.push(`${input.syncHealth.received} receipt(s) are waiting to process.`);
  }
  if (input.syncHealth.rejected > 0) {
    reasons.push(`${input.syncHealth.rejected} receipt(s) need review.`);
  }

  return {
    state: reasons.length === 0 ? "ready" : "blocked",
    headline:
      reasons.length === 0
        ? "Field operational release gate is ready"
        : "Field operational release gate is blocked",
    reasons,
    readiness: input.readiness,
    latestDecision: input.latestDecision,
    syncHealth: input.syncHealth,
  };
}
