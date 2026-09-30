import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFieldReleaseEvidence } from "./field-release-evidence";
import type { FieldReleaseReadinessSummary } from "./field-release-readiness";

const readiness: FieldReleaseReadinessSummary = {
  state: "ready",
  headline: "Field release-ready (latest finalized verification)",
  detail: "8 scenarios passed.",
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

describe("Field release evidence", () => {
  it("packages verification and decision evidence without changing it", () => {
    const evidence = buildFieldReleaseEvidence({
      generatedAt: new Date("2026-09-30T13:00:00.000Z"),
      readiness,
      latestVerification: null,
      latestDecision: {
        status: "approved",
        action: "FIELD_RELEASE_DECISION_APPROVED",
        occurredAt: "2026-09-30T12:05:00.000Z",
        actorId: "manager_1",
        actorDisplayName: "Manager",
        message: "Ready for release.",
        readinessState: "ready",
        verificationSubmissionId: "verification_1",
      },
      recentDecisions: [],
    });

    assert.equal(evidence.schemaVersion, "field-release-evidence-v1");
    assert.equal(evidence.generatedAt, "2026-09-30T13:00:00.000Z");
    assert.equal(evidence.readiness.submissionId, "verification_1");
    assert.equal(evidence.latestDecision.status, "approved");
    assert.equal(evidence.latestVerification, null);
  });
});
