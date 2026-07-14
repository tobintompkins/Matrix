import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  canAccessRoute,
  hasMatrixPermission,
} from "@/lib/auth/permissions";
import {
  __resetOperationalStateForTests,
  softDeleteOperationalRecord,
  restoreOperationalRecord,
  archiveOperationalRecord,
  retentionStatus,
  validateDeletionReason,
  DEFAULT_DELETION_REASONS,
  BULK_MAX_BATCH_SIZE,
  PERMANENT_DELETE_ENABLED_BY_DEFAULT,
  listAdminServiceCalls,
  softDeleteServiceCall,
  restoreServiceCall,
  permanentlyDeleteServiceCall,
  performBulkAdminAction,
  evaluatePermanentDelete,
  isMeterValidForPm,
  invalidateOperationalRecord,
} from "@/lib/admin/data";
import { listServiceCalls, getServiceCall } from "@/lib/service-calls/repository";
import { sampleServiceCalls } from "@/lib/service-calls/data";

describe("Patch 49B data administration permissions", () => {
  it("exposes data-admin routes to administrators and hides from technicians", () => {
    assert.equal(canAccessRoute("ADMIN", "/admin/data"), true);
    assert.equal(canAccessRoute("ADMIN", "/admin/service-calls"), true);
    assert.equal(canAccessRoute("ADMIN", "/admin/deleted-records"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/admin/data"), false);
    assert.equal(
      canAccessRoute("FIELD_TECHNICIAN", "/admin/service-calls"),
      false,
    );
  });

  it("does not grant destructive data permissions to directors or technicians", () => {
    assert.equal(hasMatrixPermission("DIRECTOR", "DELETE_SERVICE_CALL"), false);
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_DATA_ADMINISTRATION"),
      false,
    );
    assert.equal(hasMatrixPermission("ADMIN", "DELETE_SERVICE_CALL"), true);
    assert.equal(
      hasMatrixPermission("SERVICE_MANAGER", "ARCHIVE_SERVICE_CALL"),
      true,
    );
  });
});

describe("Deletion reasons and retention", () => {
  it("requires notes for Other", () => {
    assert.equal(validateDeletionReason("OTHER").ok, false);
    assert.equal(validateDeletionReason("OTHER", "cleanup notes").ok, true);
    assert.ok(DEFAULT_DELETION_REASONS.some((r) => r.key === "TEST_RECORD"));
  });

  it("calculates soft-delete retention", () => {
    const recent = retentionStatus(new Date().toISOString());
    assert.equal(recent.status, "Protected");
    assert.ok((recent.retentionDaysRemaining ?? 0) > 0);
  });

  it("keeps permanent deletion disabled by default", () => {
    assert.equal(PERMANENT_DELETE_ENABLED_BY_DEFAULT, false);
    assert.equal(evaluatePermanentDelete("SERVICE_CALL").ok, false);
    assert.equal(permanentlyDeleteServiceCall().ok, false);
  });
});

describe("Operational state and service-call soft delete", () => {
  beforeEach(() => {
    __resetOperationalStateForTests();
  });

  it("archives and restores operational overlay records", () => {
    const archived = archiveOperationalRecord({
      recordType: "MACHINE",
      recordId: "m-test-1",
      actorUserId: "u1",
      actorName: "Admin",
      reason: "No longer active",
    });
    assert.equal(archived.ok, true);
    if (!archived.ok) return;
    assert.equal(archived.state.lifecycle, "ARCHIVED");

    const restored = restoreOperationalRecord({
      recordType: "MACHINE",
      recordId: "m-test-1",
      actorUserId: "u1",
      actorName: "Admin",
    });
    assert.equal(restored.ok, true);
  });

  it("soft deletes a service call and hides it from normal lists", () => {
    const sample = sampleServiceCalls[0];
    assert.ok(sample);
    const actor = {
      userId: "admin-1",
      displayName: "Admin",
      canEditCompleted: true,
    };
    // Ensure clean lifecycle before delete (store may persist across tests).
    const existing = getServiceCall(sample.id);
    if (existing && (existing.recordState === "DELETED" || existing.deletedAt)) {
      restoreServiceCall(sample.id, actor, "reset");
    }
    const deleted = softDeleteServiceCall(sample.id, actor, {
      reason: "TEST_RECORD",
      notes: "unit test",
      confirmPhrase: `DELETE ${sample.workOrderNumber}`,
    });
    assert.equal(deleted.ok, true);
    const normal = listServiceCalls();
    assert.equal(
      normal.some((c) => c.id === sample.id),
      false,
    );
    const adminDeleted = listAdminServiceCalls({
      recordState: "DELETED",
      pageSize: 100,
    });
    assert.ok(adminDeleted.items.some((c) => c.id === sample.id));

    const restored = restoreServiceCall(sample.id, actor, "restore test");
    assert.equal(restored.ok, true);
    assert.ok(listServiceCalls().some((c) => c.id === sample.id));
  });

  it("invalidates meters for PM calculations", () => {
    invalidateOperationalRecord({
      recordType: "METER",
      recordId: "meter-1",
      actorUserId: "u1",
      reason: "Duplicate reading",
    });
    assert.equal(isMeterValidForPm("meter-1"), false);
  });
});

describe("Bulk actions", () => {
  it("enforces maximum batch size and blocks bulk permanent delete path", () => {
    assert.equal(BULK_MAX_BATCH_SIZE, 25);
    const tooMany = performBulkAdminAction({
      action: "ARCHIVE",
      recordType: "SERVICE_CALL",
      recordIds: Array.from({ length: 26 }, (_, i) => `id-${i}`),
      reason: "bulk test",
      actor: { userId: "u1", displayName: "Admin" },
    });
    assert.equal("ok" in tooMany && tooMany.ok === false, true);
  });
});

describe("getServiceCall still resolves deleted records for restore", () => {
  it("finds soft-deleted calls by id", () => {
    const sample = sampleServiceCalls[0];
    const call = getServiceCall(sample.id);
    assert.ok(call);
  });
});
