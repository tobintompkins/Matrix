import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareWorkOrderQueues,
  type WorkOrderCompareRow,
} from "./office-queue-compare";

function row(partial: Partial<WorkOrderCompareRow> & Pick<WorkOrderCompareRow, "id" | "workOrderNumber">): WorkOrderCompareRow {
  return {
    legacyWorkOrderId: null,
    title: partial.title ?? "Test",
    assignedTechnician: "",
    scheduledStart: null,
    scheduledEnd: null,
    status: "NEW",
    updatedAt: "2026-09-25T10:00:00.000Z",
    ...partial,
  };
}

describe("office queue compare", () => {
  it("matches browser and server rows by work-order number", () => {
    const browser = [row({ id: "b1", workOrderNumber: "WO-2026-000001", status: "NEW" })];
    const server = [row({ id: "s1", workOrderNumber: "WO-2026-000001", status: "NEW" })];
    const result = compareWorkOrderQueues(browser, server);
    assert.equal(result.matchedCount, 1);
    assert.equal(result.missingOnServer.length, 0);
    assert.equal(result.missingOnBrowser.length, 0);
    assert.equal(result.readyForOfficeFlag, true);
  });

  it("matches copied records through legacy browser IDs", () => {
    const browser = [row({ id: "browser-old-id", workOrderNumber: "WO-2026-000002" })];
    const server = [
      row({
        id: "server-new-id",
        workOrderNumber: "WO-2026-000002",
        legacyWorkOrderId: "browser-old-id",
      }),
    ];
    const result = compareWorkOrderQueues(browser, server);
    assert.equal(result.matchedCount, 1);
    assert.equal(result.missingOnServer.length, 0);
  });

  it("reports missing records and field mismatches", () => {
    const browser = [
      row({ id: "b1", workOrderNumber: "WO-2026-000001", assignedTechnician: "Alex" }),
      row({ id: "b2", workOrderNumber: "WO-2026-000002" }),
    ];
    const server = [
      row({ id: "s1", workOrderNumber: "WO-2026-000001", assignedTechnician: "Sam" }),
      row({ id: "s3", workOrderNumber: "WO-2026-000099" }),
    ];
    const result = compareWorkOrderQueues(browser, server);
    assert.equal(result.missingOnServer.length, 1);
    assert.equal(result.missingOnBrowser.length, 1);
    assert.equal(result.matched[0]?.mismatches[0]?.field, "assignedTechnician");
    assert.equal(result.readyForOfficeFlag, false);
  });
});
