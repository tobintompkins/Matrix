import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateFieldOperationalReleaseGate } from "./field-operational-release-gate";

const readyReadiness = {
  state: "ready" as const,
  headline: "Ready",
  detail: "All checks passed.",
  hasFinalizedRecord: true,
  submissionId: "verification_1",
  submittedAt: "2026-09-30T12:00:00.000Z",
  testerName: "Alex",
  deviceLabel: "iPhone",
  browserLabel: "Safari",
  testDate: "2026-09-30",
  passedCount: 8,
  failedCount: 0,
  failedScenarios: [],
};

const emptyHealth = { received: 0, applied: 8, rejected: 0, oldestReceivedAt: null, byType: [] };

describe("Field operational release gate", () => {
  it("is ready only with matching approval and an empty actionable queue", () => {
    const gate = evaluateFieldOperationalReleaseGate({
      readiness: readyReadiness,
      latestDecision: {
        status: "approved", action: "FIELD_RELEASE_DECISION_APPROVED", occurredAt: "2026-09-30T12:10:00.000Z",
        actorId: "manager", actorDisplayName: "Manager", message: null, readinessState: "ready", verificationSubmissionId: "verification_1",
      },
      syncHealth: emptyHealth,
    });
    assert.equal(gate.state, "ready");
    assert.deepEqual(gate.reasons, []);
  });

  it("blocks when a new verification was not approved and receipts need attention", () => {
    const gate = evaluateFieldOperationalReleaseGate({
      readiness: readyReadiness,
      latestDecision: {
        status: "approved", action: "FIELD_RELEASE_DECISION_APPROVED", occurredAt: null,
        actorId: null, actorDisplayName: null, message: null, readinessState: "ready", verificationSubmissionId: "older_verification",
      },
      syncHealth: { ...emptyHealth, received: 2, rejected: 1 },
    });
    assert.equal(gate.state, "blocked");
    assert.equal(gate.reasons.length, 3);
  });
});
