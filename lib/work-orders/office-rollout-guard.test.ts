import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareWorkOrderQueues, type WorkOrderCompareRow } from "./office-queue-compare";
import { evaluateOfficeRolloutGuard } from "./office-rollout-guard";

function row(partial: Partial<WorkOrderCompareRow> & Pick<WorkOrderCompareRow, "id" | "workOrderNumber">): WorkOrderCompareRow {
  return {
    legacyWorkOrderId: null,
    title: "Test",
    assignedTechnician: "",
    scheduledStart: null,
    scheduledEnd: null,
    status: "NEW",
    updatedAt: "2026-09-25T10:00:00.000Z",
    ...partial,
  };
}

describe("office rollout guard", () => {
  it("allows rollout when comparison is clean", () => {
    const comparison = compareWorkOrderQueues(
      [row({ id: "b1", workOrderNumber: "WO-2026-000001" })],
      [row({ id: "s1", workOrderNumber: "WO-2026-000001" })],
    );
    const guard = evaluateOfficeRolloutGuard(comparison);
    assert.equal(guard.status, "ready");
    assert.equal(guard.readyToEnableOfficeFlag, true);
  });

  it("blocks rollout when records are missing or fields mismatch", () => {
    const comparison = compareWorkOrderQueues(
      [row({ id: "b1", workOrderNumber: "WO-2026-000001", status: "NEW" })],
      [row({ id: "s1", workOrderNumber: "WO-2026-000001", status: "ASSIGNED" })],
    );
    const guard = evaluateOfficeRolloutGuard(comparison);
    assert.equal(guard.status, "blocked");
    assert.equal(guard.readyToEnableOfficeFlag, false);
    assert.ok(guard.reasons.some((reason) => reason.includes("mismatch")));
  });

  it("blocks rollout when either queue has unmatched records", () => {
    const comparison = compareWorkOrderQueues(
      [row({ id: "b1", workOrderNumber: "WO-2026-000001" }), row({ id: "b2", workOrderNumber: "WO-2026-000002" })],
      [row({ id: "s1", workOrderNumber: "WO-2026-000001" })],
    );
    const guard = evaluateOfficeRolloutGuard(comparison);
    assert.equal(guard.status, "blocked");
    assert.ok(guard.reasons.some((reason) => reason.includes("missing on the server")));
  });
});
