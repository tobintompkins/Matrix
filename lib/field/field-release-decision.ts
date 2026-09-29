import type { FieldReleaseReadinessSummary } from "./field-release-readiness";

export type FieldReleaseDecision = "approve" | "hold" | "revoke";

export type FieldReleaseDecisionStatus = "none" | "approved" | "held" | "revoked";

export const FIELD_RELEASE_DECISION_ACTIONS = {
  approve: "FIELD_RELEASE_DECISION_APPROVED",
  hold: "FIELD_RELEASE_DECISION_HOLD",
  revoke: "FIELD_RELEASE_DECISION_REVOKED",
} as const;

export const FIELD_RELEASE_DECISION_AUDIT_ENTITY_TYPE = "FieldReleaseDecision";
export const FIELD_RELEASE_DECISION_ENTITY_ID = "field-release-decision-v1";

export const FIELD_RELEASE_APPROVE_CONFIRMATION = "FIELD_RELEASE_DECISION_APPROVE";

export const FIELD_RELEASE_HOLD_CONFIRMATION =
  "I confirm holding Field release readiness. This is audited and does not change Field sync or bridge flags.";

export const FIELD_RELEASE_REVOKE_CONFIRMATION =
  "Revoke Field release readiness approval? This is audited. Field sync, bridge, and verification records are unchanged.";

export function resolveFieldReleaseDecisionStatus(
  action: string | undefined,
): FieldReleaseDecisionStatus {
  if (action === FIELD_RELEASE_DECISION_ACTIONS.approve) return "approved";
  if (action === FIELD_RELEASE_DECISION_ACTIONS.hold) return "held";
  if (action === FIELD_RELEASE_DECISION_ACTIONS.revoke) return "revoked";
  return "none";
}

export function expectedFieldReleaseDecisionConfirmation(
  decision: FieldReleaseDecision,
): string {
  if (decision === "approve") return FIELD_RELEASE_APPROVE_CONFIRMATION;
  if (decision === "hold") return FIELD_RELEASE_HOLD_CONFIRMATION;
  return FIELD_RELEASE_REVOKE_CONFIRMATION;
}

export type FieldReleaseDecisionAuditEntry = {
  id: string;
  action: string;
  decision: FieldReleaseDecisionStatus;
  occurredAt: string;
  actorId: string | null;
  actorDisplayName: string | null;
  message: string | null;
  readinessState: string | null;
  verificationSubmissionId: string | null;
};

export type FieldReleaseDecisionRecord = {
  status: FieldReleaseDecisionStatus;
  action: string | null;
  occurredAt: string | null;
  actorId: string | null;
  actorDisplayName: string | null;
  message: string | null;
  readinessState: string | null;
  verificationSubmissionId: string | null;
};

export function buildFieldReleaseDecisionAuditPayload(input: {
  decision: FieldReleaseDecision;
  readiness: FieldReleaseReadinessSummary;
  note?: string;
  actorDisplayName: string;
  actorEmail?: string;
}) {
  return {
    decision: input.decision,
    actorDisplayName: input.actorDisplayName,
    actorEmail: input.actorEmail ?? null,
    note: input.note?.trim() || null,
    readinessState: input.readiness.state,
    readinessHeadline: input.readiness.headline,
    verificationSubmissionId: input.readiness.submissionId,
    testerName: input.readiness.testerName,
    deviceLabel: input.readiness.deviceLabel,
    testDate: input.readiness.testDate,
    failedScenarioCount: input.readiness.failedScenarios.length,
  };
}
