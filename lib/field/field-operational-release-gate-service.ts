import type { FieldDeviceVerificationSubmissionSummary } from "./device-verification-submission";
import type { FieldReleaseDecisionRecord } from "./field-release-decision";
import { evaluateFieldOperationalReleaseGate } from "./field-operational-release-gate";
import { buildFieldReleaseReadinessFromLatestSubmission } from "./field-release-readiness";
import { buildFieldSyncOperationsHealth, type FieldSyncHealthRow } from "./sync-operations-health";

export function buildFieldOperationalReleaseGate(input: {
  latestVerification: FieldDeviceVerificationSubmissionSummary | null;
  latestDecision: FieldReleaseDecisionRecord;
  rows: FieldSyncHealthRow[];
  oldestReceivedAt: Date | string | null;
}) {
  return evaluateFieldOperationalReleaseGate({
    readiness: buildFieldReleaseReadinessFromLatestSubmission(input.latestVerification),
    latestDecision: input.latestDecision,
    syncHealth: buildFieldSyncOperationsHealth(input.rows, input.oldestReceivedAt),
  });
}
