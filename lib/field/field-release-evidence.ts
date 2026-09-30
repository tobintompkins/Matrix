import type {
  FieldReleaseDecisionAuditEntry,
  FieldReleaseDecisionRecord,
} from "./field-release-decision";
import type { FieldReleaseReadinessSummary } from "./field-release-readiness";
import type { FieldDeviceVerificationSubmissionSummary } from "./device-verification-submission";

export type FieldReleaseEvidence = {
  schemaVersion: "field-release-evidence-v1";
  generatedAt: string;
  readiness: FieldReleaseReadinessSummary;
  latestVerification: FieldDeviceVerificationSubmissionSummary | null;
  latestDecision: FieldReleaseDecisionRecord;
  recentDecisions: FieldReleaseDecisionAuditEntry[];
};

/**
 * Creates a portable, read-only release record for change review. The source
 * verification and audit rows remain the durable system records.
 */
export function buildFieldReleaseEvidence(input: {
  generatedAt?: Date;
  readiness: FieldReleaseReadinessSummary;
  latestVerification: FieldDeviceVerificationSubmissionSummary | null;
  latestDecision: FieldReleaseDecisionRecord;
  recentDecisions: FieldReleaseDecisionAuditEntry[];
}): FieldReleaseEvidence {
  return {
    schemaVersion: "field-release-evidence-v1",
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    readiness: input.readiness,
    latestVerification: input.latestVerification,
    latestDecision: input.latestDecision,
    recentDecisions: input.recentDecisions,
  };
}
