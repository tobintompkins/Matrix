import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  applyWorkSessionAction,
  buildCompletionChecklist,
  buildFieldHomeMetrics,
  buildOfflinePackageSnapshot,
  cancelOperation,
  clearOfflineDataSafely,
  clearProcessedOpIdsForTests,
  detectConflict,
  downloadWorkOrderPackage,
  enqueueOperation,
  filterFieldWorkOrders,
  getOperation,
  listOperations,
  resolveConflictChoice,
  retryOperation,
  synchronizeQueue,
  useMemoryOfflineStoreForTests,
  validateSessionAction,
  type OfflineOperation,
  type SyncApplyFn,
} from "@/lib/field";
import {
  canDownloadOfflinePackages,
  canResolveFieldConflicts,
  canUseOfflineField,
  canViewField,
} from "@/lib/auth/field-permissions";
import { sampleWorkOrders } from "@/lib/work-orders/data";

describe("field offline store & queue", () => {
  beforeEach(() => {
    useMemoryOfflineStoreForTests();
    clearProcessedOpIdsForTests();
  });

  it("enqueues idempotent operations by operationId", async () => {
    const a = await enqueueOperation({
      type: "NOTE",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: "wo-1",
      payload: { note: "hello" },
      operationId: "op-fixed-1",
    });
    const b = await enqueueOperation({
      type: "NOTE",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: "wo-1",
      payload: { note: "different" },
      operationId: "op-fixed-1",
    });
    assert.equal(a.operationId, b.operationId);
    assert.equal((await listOperations()).length, 1);
    assert.equal(b.payload.note, "hello");
  });

  it("requires confirmation to cancel unsynced items", async () => {
    const op = await enqueueOperation({
      type: "NOTE",
      userId: "tech-1",
      technicianName: "Alex",
      payload: { note: "x" },
    });
    const denied = await cancelOperation(op.operationId, false);
    assert.equal(denied.ok, false);
    const ok = await cancelOperation(op.operationId, true);
    assert.equal(ok.ok, true);
    const refreshed = await getOperation(op.operationId);
    assert.equal(refreshed?.status, "CANCELLED");
  });
});

describe("field packages", () => {
  beforeEach(() => {
    useMemoryOfflineStoreForTests();
  });

  it("builds selective offline packages with size estimate", async () => {
    const wo = sampleWorkOrders[0];
    assert.ok(wo);
    const snapshot = buildOfflinePackageSnapshot(wo);
    assert.equal(snapshot.workOrder.workOrderNumber, wo.workOrderNumber);
    assert.ok(snapshot.customer.name);
    const pkg = await downloadWorkOrderPackage({
      workOrder: wo,
      technicianId: "tech-1",
    });
    assert.equal(pkg.workOrderId, wo.id);
    assert.ok(pkg.sizeBytes > 0);
    assert.equal(pkg.readiness, "READY");
  });
});

describe("work sessions", () => {
  beforeEach(() => {
    useMemoryOfflineStoreForTests();
  });

  it("requires reason for pause", () => {
    const bad = validateSessionAction("PAUSE_WORK", "");
    assert.equal(bad.ok, false);
    const good = validateSessionAction("PAUSE_WORK", "Waiting on access");
    assert.equal(good.ok, true);
  });

  it("prevents duplicate active sessions across work orders", async () => {
    const first = await applyWorkSessionAction({
      workOrderId: "wo-a",
      technicianId: "tech-1",
      technicianName: "Alex",
      action: "START_WORK",
    });
    assert.equal(first.ok, true);
    const second = await applyWorkSessionAction({
      workOrderId: "wo-b",
      technicianId: "tech-1",
      technicianName: "Alex",
      action: "START_WORK",
    });
    assert.equal(second.ok, false);
  });
});

describe("sync engine", () => {
  beforeEach(() => {
    useMemoryOfflineStoreForTests();
    clearProcessedOpIdsForTests();
  });

  it("synchronizes in dependency order and is idempotent", async () => {
    const seen: string[] = [];
    const apply: SyncApplyFn = async (op) => {
      seen.push(op.type);
      return { ok: true };
    };

    const status = await enqueueOperation({
      type: "STATUS_CHANGE",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: "wo-1",
      payload: { status: "ON_SITE" },
      operationId: "op-status",
    });
    await enqueueOperation({
      type: "COMPLETION",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: "wo-1",
      payload: {},
      operationId: "op-complete",
      dependsOn: [status.operationId],
    });
    await enqueueOperation({
      type: "NOTE",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: "wo-1",
      payload: { note: "n" },
      operationId: "op-note",
    });

    const attempt = await synchronizeQueue({ apply, userId: "tech-1" });
    assert.equal(attempt.status, "SUCCESS");
    assert.equal(attempt.succeeded, 3);
    assert.ok(seen.indexOf("STATUS_CHANGE") < seen.indexOf("COMPLETION"));
    assert.ok(seen.indexOf("NOTE") < seen.indexOf("COMPLETION"));

    // Second sync should not re-apply (already synchronized)
    const again = await synchronizeQueue({ apply, userId: "tech-1" });
    assert.equal(again.succeeded, 0);
  });

  it("does not retry permanently invalid ops forever", async () => {
    await enqueueOperation({
      type: "NOTE",
      userId: "tech-1",
      technicianName: "Alex",
      payload: {},
      operationId: "op-bad",
    });
    const apply: SyncApplyFn = async () => ({
      ok: false,
      error: "invalid",
      permanent: true,
    });
    const attempt = await synchronizeQueue({ apply, userId: "tech-1" });
    assert.equal(attempt.failed, 1);
    const op = await getOperation("op-bad");
    assert.equal(op?.status, "FAILED");
    assert.equal(op?.retryCount, 5);
  });

  it("retries individual failed items", async () => {
    await enqueueOperation({
      type: "NOTE",
      userId: "tech-1",
      technicianName: "Alex",
      payload: { note: "retry me" },
      operationId: "op-retry",
    });
    let failOnce = true;
    const apply: SyncApplyFn = async () => {
      if (failOnce) {
        failOnce = false;
        return { ok: false, error: "temp" };
      }
      return { ok: true };
    };
    await synchronizeQueue({ apply, userId: "tech-1" });
    const result = await retryOperation("op-retry", apply);
    assert.equal(result.ok, true);
  });
});

describe("conflicts", () => {
  it("detects server changes after download", () => {
    const conflict = detectConflict({
      operationId: "op-1",
      entityType: "WorkOrder",
      entityId: "wo-1",
      field: "status",
      offlineValue: "COMPLETED",
      offlineChangedAt: "2026-07-10T12:00:00.000Z",
      serverValue: "CANCELLED",
      serverChangedAt: "2026-07-10T13:00:00.000Z",
      serverChangedBy: "Manager",
      downloadedRevision: "2026-07-10T11:00:00.000Z",
    });
    assert.ok(conflict);
    assert.equal(conflict?.recommended, "KEEP_SERVER");
  });

  it("restricts destructive override for technicians", () => {
    const conflict = detectConflict({
      operationId: "op-1",
      entityType: "WorkOrder",
      entityId: "wo-1",
      field: "status",
      offlineValue: "COMPLETED",
      offlineChangedAt: "2026-07-10T12:00:00.000Z",
      serverValue: "CANCELLED",
      serverChangedAt: "2026-07-10T13:00:00.000Z",
      serverChangedBy: "Manager",
      downloadedRevision: "2026-07-10T11:00:00.000Z",
    })!;
    const denied = resolveConflictChoice(
      conflict,
      "SUBMIT_OFFLINE",
      "Tech",
      "FIELD_TECHNICIAN",
    );
    assert.equal(denied.ok, false);
    const allowed = resolveConflictChoice(
      conflict,
      "KEEP_SERVER",
      "Manager",
      "SERVICE_MANAGER",
    );
    assert.equal(allowed.ok, true);
  });
});

describe("field helpers & completion", () => {
  it("filters assigned work and builds home metrics", () => {
    const orders = sampleWorkOrders;
    const filtered = filterFieldWorkOrders(orders, "CRITICAL", [], "", undefined);
    assert.ok(filtered.every((w) => w.priority === "CRITICAL"));
    const metrics = buildFieldHomeMetrics({
      technicianName: orders[0]?.assignedTechnician ?? "Tech",
      workOrders: orders,
      connectivity: "ONLINE",
      unsyncedChanges: 2,
    });
    assert.equal(metrics.unsyncedChanges, 2);
    assert.ok(metrics.technicianName);
  });

  it("builds completion checklist with missing items", () => {
    const wo = {
      ...sampleWorkOrders[0],
      notes: "",
      customerVisibleNotes: "",
      copyCountAtEnd: null,
      actualHours: null,
      actualStart: null,
      customerSignature: null,
      attachments: [],
      status: "ON_SITE" as const,
    };
    const checklist = buildCompletionChecklist({
      workOrder: wo,
      hasSignatureOrDecline: false,
      hasPhotos: false,
      maintenanceRequired: true,
      maintenanceDone: false,
      unsyncedCount: 1,
      followUpRecorded: false,
    });
    assert.equal(checklist.ready, false);
    assert.ok(checklist.missing.length > 0);
  });

  it("blocks clearing unsynced data without confirmation", async () => {
    const denied = await clearOfflineDataSafely({
      clearAll: async () => {},
      hasUnsynced: true,
      confirmClearUnsynced: false,
    });
    assert.equal(denied.ok, false);
  });
});

describe("field permissions", () => {
  it("grants technicians field + offline, managers conflict resolve", () => {
    assert.equal(canViewField("FIELD_TECHNICIAN"), true);
    assert.equal(canUseOfflineField("FIELD_TECHNICIAN"), true);
    assert.equal(canDownloadOfflinePackages("FIELD_TECHNICIAN"), true);
    assert.equal(canResolveFieldConflicts("FIELD_TECHNICIAN"), false);
    assert.equal(canResolveFieldConflicts("SERVICE_MANAGER"), true);
    assert.equal(canResolveFieldConflicts("ADMIN"), true);
  });
});

describe("field integration — offline complete then sync once", () => {
  beforeEach(() => {
    useMemoryOfflineStoreForTests();
    clearProcessedOpIdsForTests();
  });

  it("downloads, queues field activity, completes offline, syncs without duplicates", async () => {
    const wo = sampleWorkOrders[0];
    assert.ok(wo);
    await downloadWorkOrderPackage({ workOrder: wo, technicianId: "tech-1" });

    await applyWorkSessionAction({
      workOrderId: wo.id,
      technicianId: "tech-1",
      technicianName: "Alex",
      action: "START_WORK",
    });

    const applied = new Set<string>();
    const apply: SyncApplyFn = async (op: OfflineOperation) => {
      if (applied.has(op.operationId)) {
        return { ok: true, duplicate: true };
      }
      applied.add(op.operationId);
      return { ok: true };
    };

    await enqueueOperation({
      type: "WORK_SESSION",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: wo.id,
      payload: { action: "START_WORK" },
      operationId: "int-session",
    });
    await enqueueOperation({
      type: "NOTE",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: wo.id,
      payload: { note: "Replaced roller" },
      operationId: "int-note",
    });
    await enqueueOperation({
      type: "COPY_COUNT",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: wo.id,
      printerId: wo.printerId,
      payload: { copyCount: 1000, phase: "end" },
      operationId: "int-cc",
    });
    await enqueueOperation({
      type: "PARTS_USAGE",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: wo.id,
      payload: { partNumber: "P-1", description: "Roller", quantityUsed: 1 },
      operationId: "int-part",
    });
    await enqueueOperation({
      type: "PHOTO",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: wo.id,
      payload: { fileName: "before.jpg", category: "BEFORE_REPAIR" },
      operationId: "int-photo",
    });
    await enqueueOperation({
      type: "SIGNATURE",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: wo.id,
      payload: { customerName: "Pat Customer" },
      operationId: "int-sig",
    });
    await enqueueOperation({
      type: "COMPLETION",
      userId: "tech-1",
      technicianName: "Alex",
      workOrderId: wo.id,
      payload: { resolution: "Fixed", completedOffline: true },
      operationId: "int-complete",
      dependsOn: ["int-session", "int-note", "int-cc", "int-part", "int-photo", "int-sig"],
    });

    const attempt = await synchronizeQueue({ apply, userId: "tech-1" });
    assert.equal(attempt.status, "SUCCESS");
    assert.equal(applied.size, 7);

    const second = await synchronizeQueue({ apply, userId: "tech-1" });
    assert.equal(second.succeeded, 0);
    assert.equal(applied.size, 7);
  });
});
