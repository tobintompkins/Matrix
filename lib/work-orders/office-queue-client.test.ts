import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapServerAuditRow,
  mapServerTimelineRow,
  resolveOfficeQueueSource,
} from "./office-queue-client";

describe("office queue client", () => {
  it("keeps browser queue as the default source", () => {
    assert.equal(resolveOfficeQueueSource(false), "browser");
    assert.equal(resolveOfficeQueueSource(true), "server");
  });

  it("maps server timeline and audit rows for UI display", () => {
    const at = new Date("2026-09-25T12:00:00.000Z");
    const timeline = mapServerTimelineRow({
      id: "t1",
      workOrderId: "wo1",
      type: "STATUS_CHANGED",
      title: "Status updated",
      description: null,
      actor: "Manager",
      occurredAt: at,
      previousValue: "NEW",
      newValue: "ASSIGNED",
    });
    assert.equal(timeline.type, "STATUS_CHANGED");
    assert.equal(timeline.occurredAt, at.toISOString());

    const audit = mapServerAuditRow({
      id: "a1",
      workOrderId: "wo1",
      field: "status",
      previousValue: "NEW",
      newValue: "ASSIGNED",
      actor: "Manager",
      occurredAt: at,
      action: "STATUS_UPDATED",
    });
    assert.equal(audit.action, "STATUS_UPDATED");
  });
});
