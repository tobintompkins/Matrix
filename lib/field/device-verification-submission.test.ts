import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDefaultFieldDeviceVerificationRecord,
  DEVICE_VERIFICATION_CHECKS,
  type DeviceVerificationCheckId,
} from "./device-verification";
import { validateFinalizedDeviceVerificationDraft } from "./device-verification-submission";

function finalizedRecord(overrides?: {
  checks?: Partial<Record<DeviceVerificationCheckId, "pass" | "fail">>;
  testerName?: string;
  deviceLabel?: string;
}) {
  const record = createDefaultFieldDeviceVerificationRecord();
  record.testerName = overrides?.testerName ?? "Alex Rivera";
  record.deviceLabel = overrides?.deviceLabel ?? "iPhone 15";
  record.browserLabel = "Mobile Safari";
  record.testDate = "2026-09-29";
  for (const item of DEVICE_VERIFICATION_CHECKS) {
    record.checks[item.id] = overrides?.checks?.[item.id] ?? "pass";
  }
  return record;
}

describe("field device verification submission", () => {
  it("rejects drafts with not-tested scenarios", () => {
    const record = finalizedRecord();
    record.checks.offline_note = "not-tested";
    const result = validateFinalizedDeviceVerificationDraft(record);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Pass or Fail/i);
  });

  it("requires tester and device metadata", () => {
    const result = validateFinalizedDeviceVerificationDraft(
      finalizedRecord({ testerName: "  ", deviceLabel: "iPad" }),
    );
    assert.equal(result.ok, false);
  });

  it("marks release ready when every scenario passed", () => {
    const result = validateFinalizedDeviceVerificationDraft(finalizedRecord());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.releaseResult, "ready");
      assert.equal(Object.keys(result.checks).length, DEVICE_VERIFICATION_CHECKS.length);
    }
  });

  it("marks release blocked when any scenario failed", () => {
    const result = validateFinalizedDeviceVerificationDraft(
      finalizedRecord({ checks: { conflict_handling: "fail" } }),
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.releaseResult, "blocked");
  });
});
