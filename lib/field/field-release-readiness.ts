import { DEVICE_VERIFICATION_CHECKS } from "./device-verification";
import type { FieldDeviceVerificationSubmissionSummary } from "./device-verification-submission";

export type FieldReleaseReadinessState = "ready" | "blocked" | "incomplete";

export type FieldReleaseReadinessSummary = {
  state: FieldReleaseReadinessState;
  headline: string;
  detail: string;
  hasFinalizedRecord: boolean;
  submissionId: string | null;
  submittedAt: string | null;
  testerName: string | null;
  deviceLabel: string | null;
  browserLabel: string | null;
  testDate: string | null;
  passedCount: number;
  failedCount: number;
  failedScenarios: Array<{ id: string; label: string }>;
};

export function buildFieldReleaseReadinessFromLatestSubmission(
  latest: FieldDeviceVerificationSubmissionSummary | null | undefined,
): FieldReleaseReadinessSummary {
  if (!latest) {
    return {
      state: "incomplete",
      headline: "No finalized device verification on file",
      detail:
        "Complete the local checklist and submit a finalized record before Field release sign-off.",
      hasFinalizedRecord: false,
      submissionId: null,
      submittedAt: null,
      testerName: null,
      deviceLabel: null,
      browserLabel: null,
      testDate: null,
      passedCount: 0,
      failedCount: 0,
      failedScenarios: [],
    };
  }

  const failedScenarios = DEVICE_VERIFICATION_CHECKS.filter(
    (item) => latest.checks[item.id] === "fail",
  ).map((item) => ({ id: item.id, label: item.label }));

  const state: FieldReleaseReadinessState =
    latest.releaseResult === "ready" ? "ready" : "blocked";

  const headline =
    state === "ready"
      ? "Field release-ready (latest finalized verification)"
      : "Field release blocked (failed scenarios in latest verification)";

  const detail =
    state === "ready"
      ? `${latest.passedCount} scenarios passed on ${latest.testDate}.`
      : `${latest.failedCount} failed · ${latest.passedCount} passed · submitted ${new Date(latest.submittedAt).toLocaleDateString()}.`;

  return {
    state,
    headline,
    detail,
    hasFinalizedRecord: true,
    submissionId: latest.id,
    submittedAt: latest.submittedAt,
    testerName: latest.testerName,
    deviceLabel: latest.deviceLabel,
    browserLabel: latest.browserLabel,
    testDate: latest.testDate,
    passedCount: latest.passedCount,
    failedCount: latest.failedCount,
    failedScenarios,
  };
}
