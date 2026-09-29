import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkOrder } from "./types";
import {
  captureBrowserQueueSnapshot,
  browserSnapshotMatchesWorkOrders,
  validateOfficeBrowserRollback,
} from "./office-queue-rollback";

function sampleOrder(id: string): WorkOrder {
  return {
    id,
    workOrderNumber: `WO-2026-${id}`,
    title: "Test",
    customerName: "Customer",
    siteName: "Site",
    serviceType: "SERVICE",
    priority: "NORMAL",
    status: "NEW",
    assignedTechnician: "",
    region: "",
    printerModel: null,
    scheduledStart: null,
    scheduledEnd: null,
    createdAt: "2026-09-28T12:00:00.000Z",
    updatedAt: "2026-09-28T12:00:00.000Z",
    notes: [],
    parts: [],
    laborHours: 0,
    attachments: [],
    signatures: [],
    copyCounts: [],
    internalNotes: [],
  };
}

describe("office browser rollback validation", () => {
  it("captures stable browser snapshots", () => {
    const orders = [sampleOrder("a"), sampleOrder("b")];
    const snapshot = captureBrowserQueueSnapshot(orders);
    assert.equal(snapshot.recordCount, 2);
    assert.equal(browserSnapshotMatchesWorkOrders(snapshot, orders), true);
  });

  it("passes rollback validation when flag is off and browser data is unchanged", () => {
    const orders = [sampleOrder("1")];
    const snapshot = captureBrowserQueueSnapshot(orders);
    const result = validateOfficeBrowserRollback({
      officeFlagEnabled: false,
      guardReady: true,
      guardBlockedReasons: [],
      snapshotBefore: snapshot,
      snapshotAfter: snapshot,
      snapshotMatchesRequest: true,
    });
    assert.equal(result.rollbackReady, true);
    assert.ok(result.checks.some((check) => check.id === "flag-off-default-browser" && check.pass));
  });

  it("passes automatic browser fallback when flag is on but guard is blocked", () => {
    const snapshot = captureBrowserQueueSnapshot([sampleOrder("1")]);
    const result = validateOfficeBrowserRollback({
      officeFlagEnabled: true,
      guardReady: false,
      guardBlockedReasons: ["1 mismatch on matched records."],
      snapshotBefore: snapshot,
      snapshotAfter: snapshot,
    });
    assert.equal(result.managerRollout.source, "browser");
    assert.equal(result.rollbackReady, true);
    assert.ok(result.checks.some((check) => check.id === "automatic-browser-fallback" && check.pass));
  });

  it("fails when browser session data changes during validation", () => {
    const before = captureBrowserQueueSnapshot([sampleOrder("1")]);
    const after = captureBrowserQueueSnapshot([sampleOrder("1"), sampleOrder("2")]);
    const result = validateOfficeBrowserRollback({
      officeFlagEnabled: false,
      guardReady: true,
      guardBlockedReasons: [],
      snapshotBefore: before,
      snapshotAfter: after,
    });
    assert.equal(result.rollbackReady, false);
    assert.ok(result.checks.some((check) => check.id === "browser-data-unchanged" && !check.pass));
  });

  it("documents env rollback when server queue is active for managers", () => {
    const snapshot = captureBrowserQueueSnapshot([sampleOrder("1")]);
    const result = validateOfficeBrowserRollback({
      officeFlagEnabled: true,
      guardReady: true,
      guardBlockedReasons: [],
      snapshotBefore: snapshot,
      snapshotAfter: snapshot,
      pilotSignoffStatus: "approved",
      isNamedPilotManager: true,
      pilotManagerConfigured: true,
      configuredPilotManager: "pilot@sfx.example",
    });
    assert.equal(result.managerRollout.indicator, "server-active-pilot");
    assert.ok(result.checks.some((check) => check.id === "env-flag-rollback" && check.pass));
    assert.ok(result.rollbackSteps.some((step) => step.includes("MATRIX_SERVER_OFFICE_WORK_ORDERS=false")));
  });
});
