import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFieldSyncProcessAuditPayload,
  mapFieldSyncProcessRun,
} from "./field-sync-process-audit";

describe("Field sync process audit", () => {
  it("summarizes all receipt processor results", () => {
    const payload = buildFieldSyncProcessAuditPayload({
      limit: 25,
      actorDisplayName: "Manager",
      results: {
        notes: { scanned: 3, applied: 2, waiting: 1 },
        parts: { scanned: 2, applied: 2, waiting: 0 },
      },
    });
    assert.equal(payload.totalScanned, 5);
    assert.equal(payload.totalApplied, 4);
    assert.equal(payload.totalWaiting, 1);
  });

  it("maps a saved audit row without exposing unrelated audit fields", () => {
    const run = mapFieldSyncProcessRun({
      id: "audit_1",
      createdAt: new Date("2026-09-30T16:00:00.000Z"),
      payload: JSON.stringify({
        actorDisplayName: "Manager",
        limit: 25,
        totalScanned: 2,
        totalApplied: 1,
        totalWaiting: 1,
        results: { notes: { scanned: 2, applied: 1, waiting: 1 } },
      }),
    });
    assert.equal(run.actorDisplayName, "Manager");
    assert.equal(run.totalApplied, 1);
    assert.equal(run.results.notes?.waiting, 1);
  });
});
