import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFieldReleaseReadinessFromLatestSubmission } from "./field-release-readiness";
import type { FieldDeviceVerificationSubmissionSummary } from "./device-verification-submission";

function submission(
  overrides: Partial<FieldDeviceVerificationSubmissionSummary>,
): FieldDeviceVerificationSubmissionSummary {
  return {
    id: "sub_1",
    submittedAt: "2026-09-29T12:00:00.000Z",
    submittedByUserId: "user_mgr",
    submittedByName: "Manager",
    testerName: "Alex",
    deviceLabel: "iPhone 15",
    browserLabel: "Mobile Safari",
    testDate: "2026-09-29",
    notes: null,
    releaseResult: "ready",
    passedCount: 8,
    failedCount: 0,
    checks: {
      assigned_work_order_download: "pass",
      offline_note: "pass",
      offline_part: "pass",
      offline_photo: "pass",
      offline_signature: "pass",
      interrupted_sync_retry: "pass",
      conflict_handling: "pass",
      work_order_completion: "pass",
    },
    ...overrides,
  };
}

describe("field release readiness", () => {
  it("reports incomplete when no finalized server record exists", () => {
    const summary = buildFieldReleaseReadinessFromLatestSubmission(null);
    assert.equal(summary.state, "incomplete");
    assert.equal(summary.hasFinalizedRecord, false);
    assert.equal(summary.failedScenarios.length, 0);
  });

  it("reports ready from the latest finalized verification", () => {
    const summary = buildFieldReleaseReadinessFromLatestSubmission(submission({}));
    assert.equal(summary.state, "ready");
    assert.equal(summary.testerName, "Alex");
    assert.equal(summary.deviceLabel, "iPhone 15");
    assert.equal(summary.testDate, "2026-09-29");
  });

  it("lists failed scenarios when release is blocked", () => {
    const summary = buildFieldReleaseReadinessFromLatestSubmission(
      submission({
        releaseResult: "blocked",
        passedCount: 7,
        failedCount: 1,
        checks: {
          assigned_work_order_download: "pass",
          offline_note: "pass",
          offline_part: "pass",
          offline_photo: "pass",
          offline_signature: "pass",
          interrupted_sync_retry: "pass",
          conflict_handling: "fail",
          work_order_completion: "pass",
        },
      }),
    );
    assert.equal(summary.state, "blocked");
    assert.equal(summary.failedScenarios.length, 1);
    assert.equal(summary.failedScenarios[0]?.id, "conflict_handling");
  });
});
