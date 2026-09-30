import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFieldSyncOperationsHealth } from "./sync-operations-health";

describe("Field sync operations health", () => {
  it("groups actionable receipt counts by type and status", () => {
    const health = buildFieldSyncOperationsHealth(
      [
        { type: "NOTE", status: "RECEIVED", count: 2 },
        { type: "NOTE", status: "APPLIED", count: 3 },
        { type: "PHOTO", status: "REJECTED", count: 1 },
        { type: "PART", status: "RECEIVED", count: 4 },
      ],
      "2026-09-30T12:00:00.000Z",
    );

    assert.equal(health.received, 6);
    assert.equal(health.applied, 3);
    assert.equal(health.rejected, 1);
    assert.equal(health.oldestReceivedAt, "2026-09-30T12:00:00.000Z");
    assert.deepEqual(health.byType, [
      { type: "NOTE", received: 2, applied: 3, rejected: 0 },
      { type: "PART", received: 4, applied: 0, rejected: 0 },
      { type: "PHOTO", received: 0, applied: 0, rejected: 1 },
    ]);
  });

  it("ignores unknown statuses and invalid counts", () => {
    const health = buildFieldSyncOperationsHealth(
      [
        { type: "NOTE", status: "PENDING", count: 4 },
        { type: "PHOTO", status: "RECEIVED", count: -1 },
        { type: "PART", status: "APPLIED", count: 1.9 },
      ],
      null,
    );

    assert.equal(health.received, 0);
    assert.equal(health.applied, 1);
    assert.equal(health.rejected, 0);
    assert.equal(health.oldestReceivedAt, null);
  });
});
