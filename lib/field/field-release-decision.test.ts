import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIELD_RELEASE_APPROVE_CONFIRMATION,
  FIELD_RELEASE_DECISION_ACTIONS,
  buildFieldReleaseDecisionAuditPayload,
  expectedFieldReleaseDecisionConfirmation,
  resolveFieldReleaseDecisionStatus,
} from "./field-release-decision";
import { buildFieldReleaseReadinessFromLatestSubmission } from "./field-release-readiness";

describe("field release decision", () => {
  it("maps audit actions to decision status", () => {
    assert.equal(
      resolveFieldReleaseDecisionStatus(FIELD_RELEASE_DECISION_ACTIONS.approve),
      "approved",
    );
    assert.equal(resolveFieldReleaseDecisionStatus(FIELD_RELEASE_DECISION_ACTIONS.hold), "held");
    assert.equal(
      resolveFieldReleaseDecisionStatus(FIELD_RELEASE_DECISION_ACTIONS.revoke),
      "revoked",
    );
    assert.equal(resolveFieldReleaseDecisionStatus(undefined), "none");
  });

  it("returns expected confirmation text per decision", () => {
    assert.equal(expectedFieldReleaseDecisionConfirmation("approve"), FIELD_RELEASE_APPROVE_CONFIRMATION);
    assert.ok(expectedFieldReleaseDecisionConfirmation("hold").includes("holding"));
    assert.ok(expectedFieldReleaseDecisionConfirmation("revoke").includes("Revoke"));
  });

  it("embeds readiness snapshot in audit payload", () => {
    const readiness = buildFieldReleaseReadinessFromLatestSubmission(null);
    const payload = buildFieldReleaseDecisionAuditPayload({
      decision: "hold",
      readiness,
      actorDisplayName: "Manager",
      note: "Waiting for tablet retest",
    });
    assert.equal(payload.decision, "hold");
    assert.equal(payload.readinessState, "incomplete");
    assert.equal(payload.note, "Waiting for tablet retest");
  });
});
