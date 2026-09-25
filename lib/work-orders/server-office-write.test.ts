import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertWorkOrderTransition } from "./workflow";
import {
  formatOfficeDate,
  parseOfficeDate,
  resolveInitialServerWorkOrderStatus,
} from "./server-office-write";

describe("server office work-order writes", () => {
  it("derives initial status from draft and assignment flags", () => {
    assert.equal(resolveInitialServerWorkOrderStatus({ asDraft: true }), "DRAFT");
    assert.equal(
      resolveInitialServerWorkOrderStatus({ assignedTechnician: "Alex" }),
      "ASSIGNED",
    );
    assert.equal(resolveInitialServerWorkOrderStatus({}), "NEW");
  });

  it("parses office schedule timestamps", () => {
    assert.equal(parseOfficeDate(undefined), undefined);
    assert.equal(parseOfficeDate(null), null);
    assert.equal(parseOfficeDate(""), null);
    const parsed = parseOfficeDate("2026-09-25T12:00:00.000Z");
    assert.ok(parsed instanceof Date);
    assert.equal(formatOfficeDate(parsed), "2026-09-25T12:00:00.000Z");
  });

  it("rejects invalid server status transitions", () => {
    const blocked = assertWorkOrderTransition("COMPLETED", "ON_SITE");
    assert.equal(blocked.ok, false);
    const allowed = assertWorkOrderTransition("NEW", "ASSIGNED");
    assert.equal(allowed.ok, true);
  });
});
