import { prisma } from "@/lib/db/prisma";
import {
  DEVICE_VERIFICATION_CHECKS,
  summarizeFieldDeviceVerificationReadiness,
  type DeviceVerificationCheckId,
  type DeviceVerificationStatus,
  type FieldDeviceVerificationRecord,
} from "./device-verification";

export type FieldDeviceVerificationReleaseResult = "ready" | "blocked";

export type FinalizedDeviceVerificationCheck = Record<
  DeviceVerificationCheckId,
  "pass" | "fail"
>;

export type FieldDeviceVerificationSubmissionSummary = {
  id: string;
  submittedAt: string;
  submittedByUserId: string;
  submittedByName: string | null;
  testerName: string;
  deviceLabel: string;
  browserLabel: string;
  testDate: string;
  notes: string | null;
  releaseResult: FieldDeviceVerificationReleaseResult;
  passedCount: number;
  failedCount: number;
  checks: FinalizedDeviceVerificationCheck;
};

export const FIELD_DEVICE_VERIFICATION_FINALIZE_CONFIRMATION =
  "FINALIZE_FIELD_DEVICE_VERIFICATION";

export function validateFinalizedDeviceVerificationDraft(
  record: FieldDeviceVerificationRecord,
): { ok: true; releaseResult: FieldDeviceVerificationReleaseResult; checks: FinalizedDeviceVerificationCheck } | { ok: false; error: string } {
  if (!record.testerName.trim()) {
    return { ok: false, error: "Tester name is required before submitting a finalized record." };
  }
  if (!record.deviceLabel.trim()) {
    return { ok: false, error: "Device label is required before submitting a finalized record." };
  }
  if (!record.testDate.trim()) {
    return { ok: false, error: "Test date is required before submitting a finalized record." };
  }

  const readiness = summarizeFieldDeviceVerificationReadiness(record);
  if (readiness.notTested > 0) {
    return {
      ok: false,
      error: "Every checklist scenario must be marked Pass or Fail before submitting.",
    };
  }
  if (readiness.state === "incomplete") {
    return { ok: false, error: "Finalize testing on the local checklist before submitting." };
  }

  const checks = {} as FinalizedDeviceVerificationCheck;
  for (const item of DEVICE_VERIFICATION_CHECKS) {
    const status = record.checks[item.id];
    if (status !== "pass" && status !== "fail") {
      return {
        ok: false,
        error: `Scenario "${item.label}" must be Pass or Fail before submitting.`,
      };
    }
    checks[item.id] = status;
  }

  const releaseResult: FieldDeviceVerificationReleaseResult =
    readiness.state === "ready" ? "ready" : "blocked";

  return { ok: true, releaseResult, checks };
}

function parseChecksJson(raw: string): FinalizedDeviceVerificationCheck {
  const parsed = JSON.parse(raw) as Record<string, DeviceVerificationStatus>;
  const checks = {} as FinalizedDeviceVerificationCheck;
  for (const item of DEVICE_VERIFICATION_CHECKS) {
    const status = parsed[item.id];
    checks[item.id] = status === "fail" ? "fail" : "pass";
  }
  return checks;
}

function mapSubmissionRow(row: {
  id: string;
  submittedAt: Date;
  submittedByUserId: string;
  submittedByName: string | null;
  testerName: string;
  deviceLabel: string;
  browserLabel: string;
  testDate: string;
  notes: string | null;
  releaseResult: string;
  passedCount: number;
  failedCount: number;
  checksJson: string;
}): FieldDeviceVerificationSubmissionSummary {
  return {
    id: row.id,
    submittedAt: row.submittedAt.toISOString(),
    submittedByUserId: row.submittedByUserId,
    submittedByName: row.submittedByName,
    testerName: row.testerName,
    deviceLabel: row.deviceLabel,
    browserLabel: row.browserLabel,
    testDate: row.testDate,
    notes: row.notes,
    releaseResult: row.releaseResult === "blocked" ? "blocked" : "ready",
    passedCount: row.passedCount,
    failedCount: row.failedCount,
    checks: parseChecksJson(row.checksJson),
  };
}

export async function listRecentFieldDeviceVerificationSubmissions(
  limit = 12,
): Promise<FieldDeviceVerificationSubmissionSummary[]> {
  const rows = await prisma.fieldDeviceVerificationSubmission.findMany({
    orderBy: { submittedAt: "desc" },
    take: Math.max(1, Math.min(limit, 50)),
  });
  return rows.map(mapSubmissionRow);
}

export async function getLatestFieldDeviceVerificationSubmission(): Promise<FieldDeviceVerificationSubmissionSummary | null> {
  const row = await prisma.fieldDeviceVerificationSubmission.findFirst({
    orderBy: { submittedAt: "desc" },
  });
  return row ? mapSubmissionRow(row) : null;
}

export async function createFieldDeviceVerificationSubmission(input: {
  record: FieldDeviceVerificationRecord;
  submittedByUserId: string;
  submittedByName: string;
}): Promise<
  | { ok: true; submission: FieldDeviceVerificationSubmissionSummary }
  | { ok: false; error: string }
> {
  const validated = validateFinalizedDeviceVerificationDraft(input.record);
  if (!validated.ok) return validated;

  const passedCount = Object.values(validated.checks).filter((s) => s === "pass").length;
  const failedCount = Object.values(validated.checks).filter((s) => s === "fail").length;

  const row = await prisma.fieldDeviceVerificationSubmission.create({
    data: {
      submittedByUserId: input.submittedByUserId,
      submittedByName: input.submittedByName,
      testerName: input.record.testerName.trim(),
      deviceLabel: input.record.deviceLabel.trim(),
      browserLabel: input.record.browserLabel.trim(),
      testDate: input.record.testDate.trim(),
      notes: input.record.notes.trim() || null,
      releaseResult: validated.releaseResult,
      passedCount,
      failedCount,
      checksJson: JSON.stringify(validated.checks),
      localDraftUpdatedAt: input.record.updatedAt,
    },
  });

  return { ok: true, submission: mapSubmissionRow(row) };
}
