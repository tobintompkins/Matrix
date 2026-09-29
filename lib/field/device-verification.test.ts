import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDefaultFieldDeviceVerificationRecord,
  DEVICE_VERIFICATION_CHECKS,
  formatFieldDeviceVerificationExport,
  loadFieldDeviceVerificationFromStorage,
  parseFieldDeviceVerificationRecord,
  saveFieldDeviceVerificationToStorage,
  summarizeFieldDeviceVerificationReadiness,
  type DeviceVerificationCheckId,
} from "./device-verification";

function memoryStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function recordWith(
  overrides: Partial<Record<DeviceVerificationCheckId, "pass" | "fail" | "not-tested">>,
) {
  const record = createDefaultFieldDeviceVerificationRecord();
  for (const item of DEVICE_VERIFICATION_CHECKS) {
    if (overrides[item.id]) record.checks[item.id] = overrides[item.id]!;
  }
  record.testerName = "Alex";
  record.deviceLabel = "iPhone 15";
  record.browserLabel = "Mobile Safari";
  record.testDate = "2026-09-29";
  return record;
}

describe("field device verification", () => {
  it("defaults every checklist item to not-tested", () => {
    const record = createDefaultFieldDeviceVerificationRecord();
    assert.equal(DEVICE_VERIFICATION_CHECKS.length, 8);
    for (const item of DEVICE_VERIFICATION_CHECKS) {
      assert.equal(record.checks[item.id], "not-tested");
    }
  });

  it("summarizes blocked when any check failed", () => {
    const record = recordWith({
      assigned_work_order_download: "pass",
      offline_note: "fail",
    });
    const summary = summarizeFieldDeviceVerificationReadiness(record);
    assert.equal(summary.state, "blocked");
    assert.equal(summary.failed, 1);
  });

  it("summarizes incomplete when checks remain not tested", () => {
    const record = recordWith({ assigned_work_order_download: "pass" });
    const summary = summarizeFieldDeviceVerificationReadiness(record);
    assert.equal(summary.state, "incomplete");
    assert.ok(summary.notTested > 0);
  });

  it("summarizes ready when every check passed", () => {
    const allPass = DEVICE_VERIFICATION_CHECKS.reduce(
      (acc, item) => {
        acc[item.id] = "pass";
        return acc;
      },
      {} as Record<DeviceVerificationCheckId, "pass">,
    );
    const summary = summarizeFieldDeviceVerificationReadiness(recordWith(allPass));
    assert.equal(summary.state, "ready");
    assert.equal(summary.passed, DEVICE_VERIFICATION_CHECKS.length);
  });

  it("persists to local storage and exports a release record", () => {
    const storage = memoryStorage();
    const saved = saveFieldDeviceVerificationToStorage(
      storage,
      recordWith({ assigned_work_order_download: "pass" }),
    );
    const loaded = loadFieldDeviceVerificationFromStorage(storage);
    assert.equal(loaded.testerName, saved.testerName);
    assert.equal(loaded.checks.assigned_work_order_download, "pass");

    const exported = formatFieldDeviceVerificationExport(
      parseFieldDeviceVerificationRecord(JSON.parse(storage.getItem("matrix-field-device-verification-v1")!)),
    );
    assert.match(exported, /Release readiness:/);
    assert.match(exported, /assigned work order download/i);
  });
});
