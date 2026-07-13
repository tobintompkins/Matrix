import {
  getConnectivityService,
} from "./connectivity";
import {
  detectConflict,
  recordConflict,
  resolveConflictChoice,
  type ConflictCheckInput,
} from "./conflicts";
import {
  appendFieldAudit,
  getOperation,
  listOperations,
  updateOperationStatus,
} from "./queue";
import { getOfflineStore, newEntityId } from "./store";
import {
  SYNC_ORDER,
  type OfflineOpType,
  type OfflineOperation,
  type SyncAttempt,
  type SyncConflict,
} from "./types";

export type SyncApplyResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; error: string; conflict?: ConflictCheckInput; permanent?: boolean };

export type SyncApplyFn = (op: OfflineOperation) => Promise<SyncApplyResult>;

const MAX_RETRIES = 5;

function backoffMs(retryCount: number): number {
  return Math.min(60_000, 500 * 2 ** retryCount);
}

function sortForSync(ops: OfflineOperation[]): OfflineOperation[] {
  return [...ops].sort((a, b) => {
    const ai = SYNC_ORDER.indexOf(a.type);
    const bi = SYNC_ORDER.indexOf(b.type);
    if (ai !== bi) return ai - bi;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Default apply — integrates with in-app sessionStorage repos when online. */
export async function defaultSyncApply(op: OfflineOperation): Promise<SyncApplyResult> {
  try {
    if (op.type === "STATUS_CHANGE" || op.type === "WORK_SESSION") {
      const { updateWorkOrderStatus, runWorkOrderQuickAction } = await import(
        "@/lib/work-orders/repository"
      );
      const workOrderId = op.workOrderId;
      if (!workOrderId) return { ok: false, error: "Missing work order.", permanent: true };
      const actor = op.technicianName;

      if (op.payload.quickAction) {
        const result = runWorkOrderQuickAction({
          workOrderId,
          action: op.payload.quickAction as "start" | "pause" | "resume" | "complete",
          actor,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true };
      }

      const status = String(op.payload.status ?? "");
      if (status) {
        const result = updateWorkOrderStatus({
          workOrderId,
          status: status as never,
          actor,
          note: String(op.payload.note ?? ""),
        });
        if (!result.ok) {
          if (result.error.includes("Cannot") || result.error.includes("transition")) {
            return {
              ok: false,
              error: result.error,
              conflict: {
                operationId: op.operationId,
                entityType: "WorkOrder",
                entityId: workOrderId,
                field: "status",
                offlineValue: status,
                offlineChangedAt: op.createdAt,
                serverValue: "UNKNOWN",
                serverChangedAt: new Date().toISOString(),
                serverChangedBy: "server",
                downloadedRevision: String(op.payload.downloadedRevision ?? ""),
              },
            };
          }
          return { ok: false, error: result.error };
        }
      }
      return { ok: true };
    }

    if (op.type === "NOTE") {
      const { addWorkOrderNote } = await import("@/lib/work-orders/repository");
      if (!op.workOrderId) return { ok: false, error: "Missing work order.", permanent: true };
      const result = addWorkOrderNote({
        workOrderId: op.workOrderId,
        note: String(op.payload.note ?? ""),
        actor: op.technicianName,
        internal: Boolean(op.payload.internal),
      });
      if (!result.ok) return { ok: false, error: result.error, permanent: true };
      return { ok: true };
    }

    if (op.type === "COPY_COUNT") {
      const { recordWorkOrderCopyCount } = await import("@/lib/work-orders/repository");
      if (!op.workOrderId) return { ok: false, error: "Missing work order.", permanent: true };
      const count = Number(op.payload.copyCount);
      if (!Number.isFinite(count)) {
        return { ok: false, error: "Invalid copy count.", permanent: true };
      }
      const woResult = recordWorkOrderCopyCount({
        workOrderId: op.workOrderId,
        copyCount: count,
        at: (op.payload.phase as "start" | "end") ?? "end",
        actor: op.technicianName,
      });
      if (!woResult.ok) return { ok: false, error: woResult.error, permanent: true };

      if (op.printerId) {
        const { recordCopyCount } = await import("@/lib/maintenance/repository");
        const mResult = recordCopyCount({
          printerId: op.printerId,
          copyCount: count,
          enteredBy: op.technicianName,
          notes: String(op.payload.note ?? ""),
          lowerCountReason: op.payload.lowerCountReason
            ? String(op.payload.lowerCountReason)
            : undefined,
        });
        if (!mResult.ok) {
          return { ok: false, error: mResult.error, permanent: true };
        }
      }
      return { ok: true };
    }

    if (op.type === "PARTS_USAGE") {
      const { addWorkOrderPart } = await import("@/lib/work-orders/repository");
      if (!op.workOrderId) return { ok: false, error: "Missing work order.", permanent: true };
      const result = addWorkOrderPart({
        workOrderId: op.workOrderId,
        partNumber: String(op.payload.partNumber ?? ""),
        description: String(op.payload.description ?? ""),
        quantity: Number(op.payload.quantityUsed ?? 1),
        unitCost: Number(op.payload.unitCost ?? 0),
        source: "truck",
        actor: op.technicianName,
      });
      if (!result.ok) return { ok: false, error: result.error, permanent: true };
      return { ok: true };
    }

    if (op.type === "SIGNATURE") {
      const { captureWorkOrderSignature, addWorkOrderNote } = await import(
        "@/lib/work-orders/repository"
      );
      if (!op.workOrderId) return { ok: false, error: "Missing work order.", permanent: true };
      if (op.payload.declined) {
        const result = addWorkOrderNote({
          workOrderId: op.workOrderId,
          note: `Signature declined: ${String(op.payload.declineReason ?? "")}`,
          actor: op.technicianName,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true };
      }
      const result = captureWorkOrderSignature({
        workOrderId: op.workOrderId,
        signatureName: String(op.payload.customerName ?? "Customer"),
        actor: op.technicianName,
      });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true };
    }

    if (op.type === "PHOTO" || op.type === "ATTACHMENT") {
      const { addWorkOrderAttachment } = await import("@/lib/work-orders/repository");
      if (!op.workOrderId) return { ok: false, error: "Missing work order.", permanent: true };
      const result = addWorkOrderAttachment({
        workOrderId: op.workOrderId,
        kind: "PHOTO",
        fileName: String(op.payload.fileName ?? "photo.jpg"),
        mimeType: String(op.payload.mimeType ?? "image/jpeg"),
        sizeBytes: Number(op.payload.sizeBytes ?? 0),
        actor: op.technicianName,
        notes: String(op.payload.caption ?? op.payload.category ?? ""),
      });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true };
    }

    if (op.type === "COMPLETION") {
      const { updateWorkOrderStatus } = await import("@/lib/work-orders/repository");
      if (!op.workOrderId) return { ok: false, error: "Missing work order.", permanent: true };
      const result = updateWorkOrderStatus({
        workOrderId: op.workOrderId,
        status: "COMPLETED",
        actor: op.technicianName,
        note: String(op.payload.resolution ?? "Completed in field (offline sync)"),
      });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true };
    }

    if (op.type === "MAINTENANCE_COMPLETION") {
      const { completeMaintenance } = await import("@/lib/maintenance/repository");
      const printerId = String(op.printerId ?? op.payload.printerId ?? "");
      if (!printerId) return { ok: false, error: "Missing printer.", permanent: true };
      const result = completeMaintenance({
        printerId,
        kind: (op.payload.kind as "PM" | "CLEANING" | "JOINT_UNIT" | "DTF_PM") ?? "PM",
        completedAt: String(op.payload.completedAt ?? new Date().toISOString()),
        copyCountAtCompletion: Number(op.payload.copyCount ?? 0),
        technician: op.technicianName,
        notes: String(op.payload.notes ?? ""),
        workPerformed: String(op.payload.workPerformed ?? ""),
      });
      if (!result.ok) return { ok: false, error: result.error, permanent: true };
      return { ok: true };
    }

    if (op.type === "TIME_ENTRY") {
      return { ok: true };
    }

    return { ok: false, error: `Unsupported op type: ${op.type}`, permanent: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sync apply failed",
    };
  }
}

const processedIds = new Set<string>();

export function clearProcessedOpIdsForTests() {
  processedIds.clear();
}

export async function synchronizeQueue(options?: {
  userId?: string;
  apply?: SyncApplyFn;
}): Promise<SyncAttempt> {
  const connectivity = getConnectivityService();
  connectivity.markSynchronizing();

  const attempt: SyncAttempt & { id: string } = {
    id: newEntityId("sync"),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "RUNNING",
    processed: 0,
    succeeded: 0,
    failed: 0,
    conflicts: 0,
    errors: [],
  };

  const apply = options?.apply ?? defaultSyncApply;
  const pending = sortForSync(
    await listOperations({
      status: ["PENDING", "FAILED"],
      userId: options?.userId,
    }),
  );

  const store = getOfflineStore();
  const doneIds = new Set(
    (await listOperations({ status: "SYNCHRONIZED" })).map((o) => o.operationId),
  );

  for (const op of pending) {
    attempt.processed += 1;

    if (op.dependsOn.some((d) => !doneIds.has(d) && !processedIds.has(d))) {
      continue;
    }

    if (processedIds.has(op.operationId) || doneIds.has(op.operationId)) {
      await updateOperationStatus(op.operationId, "SYNCHRONIZED", {
        synchronizedAt: new Date().toISOString(),
      });
      attempt.succeeded += 1;
      continue;
    }

    if (op.retryCount >= MAX_RETRIES) {
      await updateOperationStatus(op.operationId, "FAILED", {
        lastError: "Max retries exceeded — permanent failure.",
      });
      attempt.failed += 1;
      attempt.errors.push(`${op.operationId}: max retries`);
      continue;
    }

    await updateOperationStatus(op.operationId, "SYNCHRONIZING");
    const result = await apply(op);

    if (result.ok) {
      processedIds.add(op.operationId);
      doneIds.add(op.operationId);
      await updateOperationStatus(op.operationId, "SYNCHRONIZED", {
        synchronizedAt: new Date().toISOString(),
        lastError: null,
      });
      attempt.succeeded += 1;
      await appendFieldAudit({
        userId: op.userId,
        action: "SYNC_SUCCESS",
        entityType: "OfflineOperation",
        entityId: op.operationId,
        operationId: op.operationId,
        previousValue: null,
        newValue: op.type,
        syncStatus: "SYNCHRONIZED",
        error: null,
      });
      continue;
    }

    if (result.conflict) {
      const conflict = detectConflict(result.conflict);
      if (conflict) {
        await recordConflict(conflict);
        await updateOperationStatus(op.operationId, "CONFLICT", {
          conflictStatus: conflict.recommended,
          lastError: result.error,
        });
        attempt.conflicts += 1;
        attempt.errors.push(`${op.operationId}: conflict`);
        continue;
      }
    }

    if (result.permanent) {
      await updateOperationStatus(op.operationId, "FAILED", {
        lastError: result.error,
        retryCount: MAX_RETRIES,
      });
      attempt.failed += 1;
      attempt.errors.push(`${op.operationId}: ${result.error}`);
      continue;
    }

    const nextRetry = op.retryCount + 1;
    await updateOperationStatus(op.operationId, "FAILED", {
      lastError: result.error,
      retryCount: nextRetry,
    });
    attempt.failed += 1;
    attempt.errors.push(`${op.operationId}: ${result.error}`);
    void backoffMs(nextRetry);
  }

  attempt.finishedAt = new Date().toISOString();
  if (attempt.failed === 0 && attempt.conflicts === 0) {
    attempt.status = "SUCCESS";
    connectivity.markOnline();
  } else if (attempt.succeeded > 0) {
    attempt.status = "PARTIAL";
    connectivity.markOnline();
  } else {
    attempt.status = "FAILED";
    connectivity.markSyncFailed();
  }

  await store.put("meta", {
    id: "last-sync-attempt",
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    status: attempt.status,
    processed: attempt.processed,
    succeeded: attempt.succeeded,
    failed: attempt.failed,
    conflicts: attempt.conflicts,
    errors: attempt.errors,
  } as SyncAttempt & { id: string });

  await store.put("meta", {
    id: "last-successful-sync",
    value:
      attempt.status === "SUCCESS" || attempt.status === "PARTIAL"
        ? attempt.finishedAt
        : null,
  } as { id: string; value: string | null });

  return attempt;
}

export async function retryOperation(
  operationId: string,
  apply?: SyncApplyFn,
): Promise<{ ok: boolean; error?: string }> {
  const op = await getOperation(operationId);
  if (!op) return { ok: false, error: "Not found" };
  if (op.status === "SYNCHRONIZED") return { ok: true };
  if (op.status === "CANCELLED") return { ok: false, error: "Cancelled" };
  await updateOperationStatus(operationId, "PENDING", { lastError: null });
  const attempt = await synchronizeQueue({
    userId: op.userId,
    apply,
  });
  const refreshed = await getOperation(operationId);
  if (refreshed?.status === "SYNCHRONIZED") return { ok: true };
  return {
    ok: false,
    error: refreshed?.lastError ?? attempt.errors[0] ?? "Retry failed",
  };
}

export async function applyConflictResolution(input: {
  conflict: SyncConflict;
  resolution: Parameters<typeof resolveConflictChoice>[1];
  resolvedBy: string;
  role: string;
  apply?: SyncApplyFn;
}): Promise<{ ok: boolean; error?: string }> {
  const resolved = resolveConflictChoice(
    input.conflict,
    input.resolution,
    input.resolvedBy,
    input.role,
  );
  if (!resolved.ok || !resolved.conflict) return { ok: false, error: resolved.error };
  await recordConflict(resolved.conflict as SyncConflict & { id: string });

  if (input.resolution === "KEEP_SERVER") {
    await updateOperationStatus(input.conflict.operationId, "CANCELLED", {
      conflictStatus: "KEEP_SERVER",
    });
    return { ok: true };
  }

  if (
    input.resolution === "SUBMIT_OFFLINE" ||
    input.resolution === "SAVE_AS_HISTORY" ||
    input.resolution === "MERGE_NOTES"
  ) {
    await updateOperationStatus(input.conflict.operationId, "PENDING", {
      conflictStatus: null,
      lastError: null,
    });
    return retryOperation(input.conflict.operationId, input.apply);
  }

  return { ok: true };
}

export function syncOrderIndex(type: OfflineOpType): number {
  return SYNC_ORDER.indexOf(type);
}
